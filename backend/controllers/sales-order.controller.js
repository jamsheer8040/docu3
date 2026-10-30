const { SalesOrder, SalesOrderItem, ServiceOrder, Customer, User, ServiceType, Invoice, sequelize } = require('../models');
const { Op } = require('sequelize');
const pricing = require('../utils/salesOrderPricing');
exports.confirmOrder=async(req,res)=>{try{const order=await require('../utils/quotationOrder').confirmation(req.params.id,req.body.action,req.user);res.json({success:true,data:order});}catch(error){res.status(error.status||500).json({success:false,message:error.message});}};
exports.getPricingDefaults = async (req, res) => {
  try { res.json({ success: true, data: { tax_rate: await pricing.defaultRate(req.user.tenant_id), document_defaults: await require('../utils/salesOrderDocument').defaults(req.user.tenant_id) } }); }
  catch (error) { res.status(500).json({ success: false, message: 'Unable to load sales order VAT defaults.' }); }
};

/**
 * Get all Sales Orders
 */
exports.getAllSalesOrders = async (req, res) => {
  try {
    const where = { tenant_id: req.user.tenant_id };
    if (req.user && req.user.Role && req.user.Role.type === 'CustomerPortal') {
      const linkedIds = req.user.LinkedCustomers ? req.user.LinkedCustomers.map(c => c.id) : [];
      where.customer_id = { [Op.in]: linkedIds };
    }

    const salesOrders = await SalesOrder.findAll({
      where,
      include: [
        { model: Customer, attributes: ['id', 'name', 'email', 'phone_whatsapp'] },
        { model: User, as: 'SalesExecutive', attributes: ['id', 'name', 'email'] },
        { 
          model: SalesOrderItem, 
          include: [
            { model: ServiceType, attributes: ['id', 'name'] }
          ] 
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: await Promise.all(salesOrders.map(order => pricing.serialize(order, req.user.tenant_id))) });
  } catch (error) {
    console.error('[SalesOrderController] Error getting sales orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Confirm or Cancel Service Item (From Customer)
 */
exports.confirmServiceItem = async (req, res) => {
  try {
    const { action, notes } = req.body;
    const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
    if(!['confirm','cancel'].includes(action))return res.status(400).json({success:false,message:'Invalid action'});
    await sequelize.transaction(async transaction=>{
      await require('../models').Tenant.findByPk(req.user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
      const item=await SalesOrderItem.findOne({where:{id:req.params.itemId,tenant_id:req.user.tenant_id},transaction,lock:transaction.LOCK.UPDATE});
      if(!item)fail('Service Item not found',404);
      const parent=await SalesOrder.findOne({where:{id:item.sales_order_id,tenant_id:req.user.tenant_id},transaction,lock:transaction.LOCK.UPDATE});
      if(!parent)fail('Sales Order not found',404);
      if(req.user.Role?.type!=='Internal'||!require('../utils/permissionRules').canRecord(req.user,'sales_orders','edit',parent))fail('Sales Order edit permission is required.',403);
      if(parent.confirmation_status==='Cancelled')fail('This sales order is cancelled.');
      if(item.service_order_id)fail('A started service cannot be confirmed or cancelled here.');
      if(action==='confirm'){
        if(item.cancelled)fail('This service item is already cancelled.');
        if(item.confirmed)return;
        await require('../utils/quotationOrder').activateForItem(parent,req.user,transaction);
        item.confirmed=true;item.confirm_notes=notes||null;
        if(req.file)item.confirm_attachment=`/uploads/documents/${req.file.filename}`;
      }else{
        if(item.confirmed)fail('This service item is already confirmed.');
        if(item.cancelled)return;
        item.cancelled=true;item.cancel_notes=notes||null;
      }
      await item.save({transaction});
      const siblings=await require('../utils/recordAccess').internalRead(()=>SalesOrderItem.findAll({where:{sales_order_id:parent.id,tenant_id:req.user.tenant_id},attributes:['cancelled'],transaction}));
      if(siblings.length&&siblings.every(row=>row.cancelled))await parent.update({confirmation_status:'Cancelled'},{transaction});
    });
    res.json({ success: true, message: `Service successfully ${action}ed` });
  } catch (error) {
    console.error('[SalesOrderController] Error confirming service:', error);
    res.status(error.status||500).json({ success: false, message: error.status?error.message:'Server error' });
  }
};

/**
 * Get single Sales Order
 */
exports.getSalesOrderById = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        { model: Customer, attributes: ['id', 'name', 'email', 'phone_whatsapp'] },
        { model: User, as: 'SalesExecutive', attributes: ['id', 'name', 'email'] },
        { 
          model: SalesOrderItem, 
          include: [
            { model: ServiceType, attributes: ['id', 'name'] },
            { 
              model: ServiceOrder, 
              attributes: ['id', 'status'],
              include: [
                { model: Invoice, attributes: ['id', 'invoice_number'] }
              ]
            }
          ] 
        }
      ]
    });

    if (!salesOrder) return res.status(404).json({ success: false, message: 'Sales Order not found' });
    if(req.user.Role?.type==='CustomerPortal'&&!req.user.LinkedCustomers?.some(c=>String(c.id)===String(salesOrder.customer_id)))return res.status(404).json({success:false,message:'Sales Order not found'});

    // Compute dynamic status for each item based on ServiceOrder
    const computedItems = salesOrder.SalesOrderItems.map(item => {
      const itemData = item.toJSON();
      if (itemData.ServiceOrder) {
        itemData.status = itemData.ServiceOrder.status;
        if (itemData.ServiceOrder.Invoice) {
          itemData.invoice = itemData.ServiceOrder.Invoice;
        }
      }
      return itemData;
    });

    const data = salesOrder.toJSON();
    data.SalesOrderItems = computedItems;

    res.json({ success: true, data: await pricing.serialize(data, req.user.tenant_id) });
  } catch (error) {
    console.error('[SalesOrderController] Error getting sales order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Create new Sales Order
 */
exports.createSalesOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    await require('../models').Tenant.findByPk(req.user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
    const { 
      customer_id, 
      contact_person, 
      sales_executive_id, 
      branch, 
      customer_reference, 
      internal_remarks, 
      items 
    } = req.body;

    if(!customer_id || !await Customer.findOne({where:{id:customer_id,tenant_id:req.user.tenant_id},attributes:['id'],transaction}))throw Object.assign(new Error('Choose an accessible customer for this sales order.'),{status:400});
    // Validate line numbers before the database can coerce fractional quantities.
    pricing.calculate(items || [], 0, 0);
    // Generate SO Number
    const order_number = await require('../utils/salesOrderNumber')(req.user.tenant_id,transaction);

    const salesOrder = await SalesOrder.create({
      ...await pricing.settings(req.body, req.user.tenant_id, null, transaction),
      ...await require('../utils/salesOrderDocument').prepare(req.body, req.user.tenant_id, null, transaction),
      order_number,
      customer_id,
      contact_person,
      sales_executive_id,
      branch,
      customer_reference,
      internal_remarks,
      tenant_id: req.user.tenant_id
    }, { transaction });

    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        sales_order_id: salesOrder.id,
        service_type_id: item.service_type_id,
        service_name: item.service_name,
        description: item.description,
        quantity: item.quantity || 1,
        cost: item.cost || 0.00,
        service_charge: item.service_charge || 0.00,
        estimated_price: item.estimated_price || 0.00,
        expected_processing_time: item.expected_processing_time,
        expected_date: require('../utils/quotationOrder').date(item.expected_date),
        priority: item.priority || 'Normal',
        status: 'Not Started',
        tenant_id: req.user.tenant_id
      }));

      await SalesOrderItem.bulkCreate(orderItems, { transaction });
    }

    const savedItems = await SalesOrderItem.findAll({ where: { tenant_id: req.user.tenant_id, sales_order_id: salesOrder.id }, transaction });
    const saved = await pricing.serialize({ ...salesOrder.toJSON(), SalesOrderItems: savedItems }, req.user.tenant_id, transaction);
    await transaction.commit();
    res.status(201).json({ success: true, data: saved, message: 'Sales Order created successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('[SalesOrderController] Error creating sales order:', error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

/**
 * Push Service Item to Services Module
 */
exports.pushService = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    if (req.user.Role?.type === 'CustomerPortal') {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Only internal users can push services.' });
    }
    const { resolveAssignee, recordAssignment } = require('../utils/serviceAssignment');
    const userId = await resolveAssignee(req.body?.assigned_user_id, req.user.tenant_id, transaction);
    const itemId = req.params.itemId;
    const item = await SalesOrderItem.findOne({
      where: { id: itemId, tenant_id: req.user.tenant_id },
      include: [{ model: SalesOrder, required: true, where: { tenant_id: req.user.tenant_id } }],
      transaction, lock: transaction.LOCK.UPDATE
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Service Item not found' });
    }

    if (item.service_order_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Service has already been pushed' });
    }

    // Create ServiceOrder
    if(item.SalesOrder.confirmation_status==='Cancelled'||!item.confirmed||item.cancelled||!item.SalesOrder.customer_id)throw Object.assign(new Error('Confirm this service item before starting it.'),{status:409});
    const serviceOrder = await ServiceOrder.create({
      customer_id: item.SalesOrder.customer_id,
      service_type_id: item.service_type_id,
      status: 'Pending',
      notes: `Pushed from Sales Order ${item.SalesOrder.order_number}\nRemarks: ${item.SalesOrder.internal_remarks || ''}\nDescription: ${item.description || ''}`,
      criticality: item.priority,
      initial_criticality: item.priority,
      tenant_id: req.user.tenant_id
    }, { transaction });

    // Link back to item and update status
    if (userId) await serviceOrder.update(await recordAssignment(serviceOrder, userId, req.user, 'SalesOrder', transaction), { transaction });
    await item.update({
      service_order_id: serviceOrder.id,
      status: 'Pending'
    }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Service successfully pushed to execution', service_order_id: serviceOrder.id });
  } catch (error) {
    await transaction.rollback();
    console.error('[SalesOrderController] Error pushing service:', error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error' });
  }
};

/**
 * Update Sales Order
 * Allows updating header info and adding more services.
 * Existing items that were pushed to execution or confirmed are preserved and never reversed.
 */
exports.updateSalesOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    await require('../models').Tenant.findByPk(req.user.tenant_id,{transaction,lock:transaction.LOCK.UPDATE});
    const { id } = req.params;
    const {
      customer_id,
      contact_person,
      sales_executive_id,
      branch,
      customer_reference,
      internal_remarks,
      items
    } = req.body;

    const salesOrder = await SalesOrder.findOne({
      where: { id, tenant_id: req.user.tenant_id },
      include: [SalesOrderItem],
      transaction
    });

    if (!salesOrder) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }

    // Update header fields
    if(salesOrder.confirmation_status==='Cancelled')throw Object.assign(new Error('Cancelled sales orders cannot be edited.'),{status:409});
    Object.assign(salesOrder, await pricing.settings(req.body, req.user.tenant_id, salesOrder, transaction));
    Object.assign(salesOrder, await require('../utils/salesOrderDocument').prepare(req.body, req.user.tenant_id, salesOrder, transaction));
    if (customer_id) {
      if(salesOrder.source_quotation_id && !await Customer.findOne({where:{id:customer_id,tenant_id:req.user.tenant_id},attributes:['id'],transaction}))throw Object.assign(new Error('Choose an accessible customer from this company.'),{status:400});
      salesOrder.customer_id = customer_id;
    }
    if (contact_person !== undefined) salesOrder.contact_person = contact_person;
    if (sales_executive_id !== undefined) salesOrder.sales_executive_id = sales_executive_id;
    if (branch !== undefined) salesOrder.branch = branch;
    if (customer_reference !== undefined) salesOrder.customer_reference = customer_reference;
    if (internal_remarks !== undefined) salesOrder.internal_remarks = internal_remarks;
    if(salesOrder.source_quotation_id && salesOrder.confirmation_status==='Unconfirmed' && req.body.recipient_snapshot)salesOrder.recipient_snapshot=require('../utils/quotationOrder').recipient(req.body.recipient_snapshot);
    if(req.body.notes!==undefined){if(typeof req.body.notes!=='string'||req.body.notes.length>5000)throw Object.assign(new Error('Notes must contain at most 5000 characters.'),{status:400});salesOrder.notes=req.body.notes;}

    await salesOrder.save({ transaction });

    // Handle service items
    if (items && Array.isArray(items)) {
      pricing.calculate(items, 0, 0);
      const existingItems = salesOrder.SalesOrderItems || [];
      const existingItemIds = existingItems.map(i => Number(i.id));

      const submittedItemIds = items
        .filter(item => item.id)
        .map(item => Number(item.id));

      // Remove unpushed & unconfirmed items omitted from payload
      for (const existingItem of existingItems) {
        if (!submittedItemIds.includes(Number(existingItem.id))) {
          if (existingItem.service_order_id || existingItem.confirmed) {
            // Cannot delete actioned items, preserve them
            continue;
          } else {
            await existingItem.destroy({ transaction });
          }
        }
      }

      // Process submitted items (edit existing or add new services)
      for (const item of items) {
        if (item.id && existingItemIds.includes(Number(item.id))) {
          const dbItem = existingItems.find(i => Number(i.id) === Number(item.id));
          if (dbItem) {
            if (!dbItem.service_order_id) {
              dbItem.service_type_id = item.service_type_id || dbItem.service_type_id;
              dbItem.service_name = item.service_name || dbItem.service_name;
              dbItem.description = item.description !== undefined ? item.description : dbItem.description;
              dbItem.quantity = item.quantity || dbItem.quantity;
              dbItem.cost = item.cost !== undefined ? item.cost : dbItem.cost;
              dbItem.service_charge = item.service_charge !== undefined ? item.service_charge : dbItem.service_charge;
              dbItem.estimated_price = item.estimated_price !== undefined ? item.estimated_price : dbItem.estimated_price;
              dbItem.expected_processing_time = item.expected_processing_time !== undefined ? item.expected_processing_time : dbItem.expected_processing_time;
              if(item.expected_date!==undefined)dbItem.expected_date=require('../utils/quotationOrder').date(item.expected_date);
              dbItem.priority = item.priority || dbItem.priority;
              await dbItem.save({ transaction });
            } else {
              if (item.description !== undefined) dbItem.description = item.description;
              if (item.priority) dbItem.priority = item.priority;
              await dbItem.save({ transaction });
            }
          }
        } else {
          // New service item added to this sales order!
          await SalesOrderItem.create({
            sales_order_id: salesOrder.id,
            service_type_id: item.service_type_id,
            service_name: item.service_name,
            description: item.description || null,
            quantity: item.quantity || 1,
            cost: item.cost || 0.00,
            service_charge: item.service_charge || 0.00,
            estimated_price: item.estimated_price || 0.00,
            expected_processing_time: item.expected_processing_time || item.expected_date || null,
            expected_date: require('../utils/quotationOrder').date(item.expected_date),
            priority: item.priority || 'Normal',
            status: 'Not Started',
            tenant_id: req.user.tenant_id
          }, { transaction });
        }
      }
    }

    const savedItems = await SalesOrderItem.findAll({ where: { tenant_id: req.user.tenant_id, sales_order_id: salesOrder.id }, transaction });
    const saved = await pricing.serialize({ ...salesOrder.toJSON(), SalesOrderItems: savedItems }, req.user.tenant_id, transaction);
    await transaction.commit();
    res.json({ success: true, message: 'Sales Order updated successfully', data: saved });
  } catch (error) {
    await transaction.rollback();
    console.error('[SalesOrderController] Error updating sales order:', error);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Server error updating sales order' });
  }
};

/**
 * Delete Sales Order
 */
exports.deleteSalesOrder = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findOne({ 
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [SalesOrderItem]
    });
    
    if (!salesOrder) return res.status(404).json({ success: false, message: 'Sales Order not found' });

    // Validation: Check if any items have been pushed to execution
    if(salesOrder.source_quotation_id)return res.status(409).json({success:false,message:'Retain converted sales orders for quotation history. Cancel an unconfirmed order instead.'});
    if (salesOrder.SalesOrderItems && salesOrder.SalesOrderItems.some(item => item.service_order_id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete Sales Order because some services have already been pushed to execution.' 
      });
    }

    const t = await sequelize.transaction();
    try {
      await SalesOrderItem.destroy({ where: { sales_order_id: salesOrder.id, tenant_id: req.user.tenant_id }, transaction: t });
      await salesOrder.destroy({ transaction: t });
      await t.commit();
      res.json({ success: true, message: 'Sales Order deleted successfully' });
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error('[SalesOrderController] Error deleting sales order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const { generateProformaInvoicePDF } = require('../utils/pdfGenerator');

/**
 * Download Proforma Invoice PDF
 */
exports.downloadProformaPDF = async (req, res) => {
  try {
    const order = await SalesOrder.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        { model: Customer },
        { model: SalesOrderItem }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Sales Order not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Proforma_Invoice_${order.order_number}.pdf`);

    if(req.user.Role?.type==='CustomerPortal'&&!req.user.LinkedCustomers?.some(c=>String(c.id)===String(order.customer_id)))return res.status(404).json({success:false,message:'Sales Order not found'});
    const pdfOrder=await pricing.serialize(order, req.user.tenant_id);
    if(order.source_quotation_id&&order.recipient_snapshot)pdfOrder.Customer={...(pdfOrder.Customer||{}),...order.recipient_snapshot,phone_whatsapp:order.recipient_snapshot.phone};
    await generateProformaInvoicePDF(pdfOrder, req.user.tenant_id, res);

  } catch (error) {
    console.error('[SalesOrderController] Error generating Proforma PDF:', error);
    res.status(500).json({ success: false, message: 'Server error generating PDF' });
  }
};

