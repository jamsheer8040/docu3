const { ServiceType, ServiceTypePricing, ServiceOrder, ServiceAssignment, User, Customer, Invoice, InvoiceItem, SalesOrderItem, sequelize } = require('../models/index.js');
const { Op } = require('sequelize');
const { resolveAssignee, recordAssignment, eligibleStaff } = require('../utils/serviceAssignment');
const { trackingFilters, summarizePerformance, completedStatuses } = require('../utils/employeePerformance');
const { actionScope, canRecord } = require('../utils/permissionRules');
const { internalRead } = require('../utils/recordAccess');
// Report permission is independent of Services permissions. Every report read
// uses an explicit tenant boundary and the logged-in employee for Own access.
const trackingOwn = req => actionScope(req.user, 'employee_tracking', 'list') === 'own';
const trackingWhere = req => ({ tenant_id: req.user.tenant_id, ...(trackingOwn(req) ? { [Op.or]: [{ assigned_user_id: req.user.id }, { completed_by_user_id: req.user.id }] } : {}) });
const staffInclude = req => req.user.Role?.type === 'CustomerPortal' ? [] : [{ model: User, as: 'AssignedStaff', attributes: ['id', 'name', 'is_active', 'avatar'], where: { tenant_id: req.user.tenant_id }, required: false }];

exports.getAssignees = async (req, res, next) => {
  try { res.json({ success: true, data: (await eligibleStaff(req.user.tenant_id)).map(user => ({ id: user.id, name: user.name })) }); }
  catch (error) { next(error); }
};
exports.getAssignmentHistory = async (req, res, next) => {
  try {
    const order = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!order) return res.status(404).json({ success: false, message: 'Service not found' });
    const data = await ServiceAssignment.findAll({ where: { tenant_id: req.user.tenant_id, service_order_id: order.id }, order: [['id', 'DESC']] });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};
exports.getEmployeeTracking = async (req, res, next) => {
  try {
    const tenant_id = req.user.tenant_id;
    const ownOnly = trackingOwn(req);
    const filters = trackingFilters(req.query);
    const [staff, orders, serviceTypes] = await Promise.all([
      internalRead(() => User.findAll({ where: { tenant_id, ...(ownOnly ? { id:req.user.id } : {}) }, attributes: ['id', 'name', 'is_active'], order: [['name', 'ASC']] })),
      internalRead(() => ServiceOrder.findAll({ where: { ...trackingWhere(req), ...(filters.service_type_id ? { service_type_id: filters.service_type_id } : {}) }, attributes: ['assigned_user_id', 'completed_by_user_id', 'status', 'created_at', 'started_at', 'completed_at'], raw: true })),
      internalRead(() => ServiceType.findAll({ where: { tenant_id }, attributes: ['id', 'name'], order: [['name', 'ASC']], raw: true }))
    ]);
    const workload = orders.filter(order => {
      const date = new Date(new Date(order.created_at).getTime() + 14400000).toISOString().slice(0, 10);
      return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
    });
    const eligibleIds = new Set((await eligibleStaff(tenant_id)).map(user => String(user.id)));
    const rows = [...(ownOnly ? [] : [{ id: 'unassigned', name: 'Unassigned', is_active: true }]), ...staff.filter(user => ownOnly || eligibleIds.has(String(user.id)) || orders.some(order => [order.assigned_user_id, order.completed_by_user_id].some(id => String(id) === String(user.id)))).map(user => user.toJSON())];
    const data = rows.map(user => {
      const own = workload.filter(order => user.id === 'unassigned' ? order.assigned_user_id == null : String(order.assigned_user_id) === String(user.id));
      const sum = statuses => own.filter(order => !statuses || statuses.includes(order.status)).length;
      const unattributed = orders.filter(order => !order.completed_by_user_id && completedStatuses.includes(order.status) && order.completed_at && String(order.assigned_user_id || 'unassigned') === String(user.id) && (!filters.from || new Date(new Date(order.completed_at).getTime() + 14400000).toISOString().slice(0, 10) >= filters.from) && (!filters.to || new Date(new Date(order.completed_at).getTime() + 14400000).toISOString().slice(0, 10) <= filters.to)).length;
      return { ...user, total: sum(), pending: sum(['Pending', 'Assigned', 'Waiting for Customer', 'On Hold']), in_progress: sum(['In Progress']), completed: sum(completedStatuses), cancelled: sum(['Cancelled']), unattributed_in_period: unattributed, ...summarizePerformance(orders, user.id, filters) };
    });
    res.json({ success: true, data, meta: { scope: ownOnly ? 'own' : 'all', service_types: serviceTypes, unattributed_completions: ownOnly ? 0 : summarizePerformance(orders, 'unassigned', filters).completed_in_period } });
  } catch (error) { next(error); }
};
exports.getTrackingOrders = async (req, res, next) => {
  try {
    const filters = trackingFilters(req.query);
    const where = trackingWhere(req);
    if (filters.service_type_id) where.service_type_id = filters.service_type_id;
    if (filters.from || filters.to) where.created_at = { ...(filters.from ? { [Op.gte]: new Date(`${filters.from}T00:00:00+04:00`) } : {}), ...(filters.to ? { [Op.lt]: new Date(new Date(`${filters.to}T00:00:00+04:00`).getTime()+86400000) } : {}) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.status_group === 'completed') where.status = { [Op.in]: completedStatuses };
    if (req.query.status_group === 'pending') where.status = { [Op.in]: ['Pending','Assigned','Waiting for Customer','On Hold'] };
    if (req.query.assigned_user_id === 'unassigned') where.assigned_user_id = null;
    else if (req.query.assigned_user_id) {
      if (!/^\d+$/.test(req.query.assigned_user_id)) return res.status(400).json({success:false,message:'Invalid employee filter.'});
      where.assigned_user_id = req.query.assigned_user_id;
    }
    const page = Math.max(1, parseInt(req.query.page) || 1), limit = Math.max(1, Math.min(200, parseInt(req.query.limit) || 15));
    const {count, rows} = await internalRead(() => ServiceOrder.findAndCountAll({where, attributes:['id','customer_id','service_type_id','created_by','assigned_user_id','completed_by_user_id','status','created_at','assigned_at','started_at','completed_at'], include:[
      {model:Customer,attributes:['id','name'],where:{tenant_id:req.user.tenant_id},required:false},
      {model:ServiceType,attributes:['id','name'],where:{tenant_id:req.user.tenant_id},required:false},
      ...staffInclude(req)
    ],distinct:true,limit,offset:(page-1)*limit,order:[['created_at','DESC'],['id','DESC']]}));
    res.json({success:true,data:rows.map(row => ({...row.toJSON(),can_view_service:canRecord(req.user,'services','detail',row),can_edit_service:canRecord(req.user,'services','edit',row)})),meta:{total:count,page}});
  } catch (error) { next(error); }
};
exports.getTrackingHistory = async (req, res, next) => {
  try {
    const order = await internalRead(() => ServiceOrder.findOne({where:{...trackingWhere(req),id:req.params.id},attributes:['id']}));
    if (!order) return res.status(404).json({success:false,message:'Service not found'});
    const data = await internalRead(() => ServiceAssignment.findAll({where:{tenant_id:req.user.tenant_id,service_order_id:order.id},attributes:['id','created_at','from_name','to_name','actor_name','reason'],order:[['id','DESC']]}));
    res.json({success:true,data});
  } catch (error) { next(error); }
};
exports.assignServiceOrder = async (req, res, next) => {
  try {
    await sequelize.transaction(async transaction => {
      const order = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!order) throw Object.assign(new Error('Service not found'), { status: 404 });
      if (['Completed', 'CompletedInvoicePending', 'CompletedInvoiceCreated', 'Cancelled'].includes(order.status)) throw Object.assign(new Error('Only open services can be reassigned.'), { status: 400 });
      if (req.body.assigned_user_id === undefined) throw Object.assign(new Error('Choose staff or Unassigned.'), { status: 400 });
      const userId = await resolveAssignee(req.body.assigned_user_id, req.user.tenant_id, transaction);
      const updates = await recordAssignment(order, userId, req.user, 'Manual', transaction);
      await order.update(updates, { transaction });
    });
    res.json({ success: true, message: 'Staff assignment updated.' });
  } catch (error) { next(error); }
};

/**
 * SERVICE TYPES (Catalog)
 */
exports.getServiceTypes = async (req, res, next) => {
  try {
    let { is_active, page = 1, limit = 10, search = '' } = req.query;
    limit = Math.min(parseInt(limit), 100);
    const offset = (page - 1) * limit;

    const where = { tenant_id: req.user.tenant_id };
    if (is_active !== undefined) where.is_active = is_active === 'true';
    if (search) where.name = { [Op.like]: `%${search}%` };

    const { count, rows } = await ServiceType.findAndCountAll({ 
      where, 
      include: [{ model: ServiceTypePricing }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']] 
    });

    res.json({ 
      success: true, 
      data: rows,
      meta: {
        total: count,
        page: parseInt(page),
        last_page: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.createServiceType = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { pricing, ...typeData } = req.body;
    const type = await ServiceType.create({ ...typeData, tenant_id: req.user.tenant_id }, { transaction });
    
    if (pricing && Array.isArray(pricing)) {
      const pricingsToCreate = pricing.map(p => ({
        ...p,
        service_type_id: type.id
      }));
      await ServiceTypePricing.bulkCreate(pricingsToCreate, { transaction });
    }
    
    await transaction.commit();
    const fullType = await ServiceType.findByPk(type.id, { include: [ServiceTypePricing] });
    res.status(201).json({ success: true, data: fullType });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.updateServiceType = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const type = await ServiceType.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!type) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Service type not found' });
    }

    const { pricing, id: pId, tenant_id, ...typeData } = req.body;
    await type.update(typeData, { transaction });

    if (pricing && Array.isArray(pricing)) {
      await ServiceTypePricing.destroy({ where: { service_type_id: type.id }, transaction });
      const pricingsToCreate = pricing.map(p => ({
        ...p,
        service_type_id: type.id
      }));
      await ServiceTypePricing.bulkCreate(pricingsToCreate, { transaction });
    }

    await transaction.commit();
    const fullType = await ServiceType.findByPk(type.id, { include: [ServiceTypePricing] });
    res.json({ success: true, data: fullType });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.deleteServiceType = async (req, res, next) => {
  try {
    const type = await ServiceType.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!type) return res.status(404).json({ success: false, message: 'Service type not found' });

    // Check if used in orders
    const count = await ServiceOrder.count({ where: { tenant_id: req.user.tenant_id, service_type_id: type.id } });
    if (count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete service type that is linked to existing orders. Deactivate it instead.' 
      });
    }

    // Check if used in sales order items
    const salesOrderCount = await SalesOrderItem.count({ 
      include: [{ model: require('../models').SalesOrder, where: { tenant_id: req.user.tenant_id }, required: true }],
      where: { service_type_id: type.id } 
    });
    if (salesOrderCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete service type that is linked to existing sales orders. Deactivate it instead.' 
      });
    }

    await type.destroy();
    res.json({ success: true, message: 'Service type deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * SERVICE ORDERS (Workflow)
 */
exports.getServiceOrders = async (req, res, next) => {
  try {
    let { status, customer_id, criticality, sort, page = 1, limit = 100 } = req.query;
    limit = Math.min(parseInt(limit), 200);
    const offset = (page - 1) * limit;

    const where = { tenant_id: req.user.tenant_id };
    if (status) where.status = status;
    if (req.query.tracking === 'true') {
      const filters = trackingFilters(req.query);
      if (filters.service_type_id) where.service_type_id = filters.service_type_id;
      if (filters.from || filters.to) where.created_at = { ...(filters.from ? { [Op.gte]: new Date(`${filters.from}T00:00:00+04:00`) } : {}), ...(filters.to ? { [Op.lt]: new Date(new Date(`${filters.to}T00:00:00+04:00`).getTime() + 86400000) } : {}) };
      if (req.query.status_group === 'completed') where.status = { [Op.in]: completedStatuses };
      if (req.query.status_group === 'pending') where.status = { [Op.in]: ['Pending', 'Assigned', 'Waiting for Customer', 'On Hold'] };
    }
    if (customer_id) where.customer_id = customer_id;
    if (criticality) where.criticality = criticality;
    if (req.query.assigned_user_id === 'unassigned') where.assigned_user_id = null;
    else if (req.query.assigned_user_id) {
      if (!/^\d+$/.test(req.query.assigned_user_id)) return res.status(400).json({ success: false, message: 'Invalid staff filter' });
      where.assigned_user_id = req.query.assigned_user_id;
    }

    // Restrict CustomerPortal users to only their linked customers
    if (req.user && req.user.Role && req.user.Role.type === 'CustomerPortal') {
      const linkedIds = req.user.LinkedCustomers ? req.user.LinkedCustomers.map(c => c.id) : [];
      where.customer_id = { [Op.in]: linkedIds };
    }

    // Criticality sort: Critical=0, Moderate=1, Normal=2
    const order = sort === 'criticality'
      ? [[
          sequelize.literal(`CASE criticality WHEN 'Critical' THEN 0 WHEN 'Moderate' THEN 1 ELSE 2 END`),
          'ASC'
        ], ['created_at', 'DESC']]
      : [['created_at', 'DESC']];

    const { count, rows } = await ServiceOrder.findAndCountAll({
      distinct: true,
      where,
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone_whatsapp'] },
        ...staffInclude(req),
        { 
          model: ServiceType, 
          attributes: ['id', 'name', 'pricing_mode', 'cost_price'],
          include: [{ model: ServiceTypePricing }]
        },
        { model: Invoice, attributes: ['id', 'invoice_number', 'status'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order
    });
    // Fetch wallet names for deducted costs
    const orderIds = rows.filter(r => r.is_cost_deducted).map(r => r.id);
    let walletTxMap = {};
    if (orderIds.length > 0) {
      const { WalletTransaction, WalletAccount } = require('../models');
      const wts = await WalletTransaction.findAll({
        where: { reference_id: orderIds, reference_type: 'ServiceCost', tenant_id: req.user.tenant_id },
        include: [{ model: WalletAccount, attributes: ['id', 'name'] }]
      });
      wts.forEach(wt => {
        if (wt.WalletAccount) {
          walletTxMap[wt.reference_id] = wt.WalletAccount.name;
        }
      });
    }

    const dataRows = rows.map(r => {
      const row = r.toJSON();
      if (row.is_cost_deducted && walletTxMap[row.id]) {
        row.deducted_wallet_name = walletTxMap[row.id];
      }
      return row;
    });

    res.json({ 
      success: true, 
      data: dataRows,
      meta: {
        total: count,
        page: parseInt(page),
        last_page: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.createServiceOrder = async (req, res, next) => {
  try {
    const order = await sequelize.transaction(async transaction => {
      const { customer_id, service_type_id, notes, criticality = 'Normal' } = req.body;
      const userId = await resolveAssignee(req.body.assigned_user_id, req.user.tenant_id, transaction);
      const [customer, type] = await Promise.all([
        Customer.findOne({ where: { id: customer_id, tenant_id: req.user.tenant_id }, transaction }),
        ServiceType.findOne({ where: { id: service_type_id, tenant_id: req.user.tenant_id }, transaction })
      ]);
      if (!customer || !type) throw Object.assign(new Error('Choose a customer and service from this tenant.'), { status: 400 });
      const created = await ServiceOrder.create({ customer_id, service_type_id, notes, criticality, initial_criticality: criticality, status: 'Pending', tenant_id: req.user.tenant_id }, { transaction });
      if (userId) await created.update(await recordAssignment(created, userId, req.user, 'Manual', transaction), { transaction });
      return created;
    });
    const fullOrder = await ServiceOrder.findOne({ where: { id: order.id, tenant_id: req.user.tenant_id }, include: [
      { model: Customer, attributes: ['id', 'name', 'phone_whatsapp'] }, ...staffInclude(req),
      { model: ServiceType, attributes: ['id', 'name', 'pricing_mode', 'cost_price'], include: [{ model: ServiceTypePricing }] },
      { model: Invoice, attributes: ['id', 'invoice_number', 'status'] }
    ] });
    res.status(201).json({ success: true, data: fullOrder });
  } catch (error) { next(error); }
};

exports.getCompletionCost = async (req,res,next) => {
  try {
    const order=await ServiceOrder.findOne({where:{id:req.params.id,tenant_id:req.user.tenant_id}});
    if(!order)return res.status(404).json({success:false,message:'Service not found'});
    const {deductionPoint,completionCost}=require('../utils/serviceCompletionCost');
    const [policy,cost]=await Promise.all([deductionPoint(order.tenant_id),completionCost(order)]);
    res.json({success:true,data:{policy,amount:cost.amount,source:cost.source,already_deducted:order.is_cost_deducted}});
  }catch(error){next(error);}
};
exports.updateServiceOrderStatus = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { status, wallet_id, cost_type, cost_supplier_id, requires_follow_up } = req.body;
    const order = await ServiceOrder.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      include: [
        { model: ServiceType, include: [{ model: ServiceTypePricing }] },
        Customer
      ],
      transaction, lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const oldStatus = order.status;
    const finished=['Completed','CompletedInvoicePending','CompletedInvoiceCreated'];
    if(finished.includes(status) && (status!=='Completed' || oldStatus!=='In Progress'))throw Object.assign(new Error('Only an In Progress service can be completed through the completion action.'),{status:409});
    const updates = { status };
    if (requires_follow_up !== undefined) {
      updates.requires_follow_up = requires_follow_up;
    }

    // CANCEL VALIDATION: block if active invoice exists or service is completed
    if (status === 'Cancelled') {
      if (oldStatus === 'CompletedInvoicePending' || oldStatus === 'CompletedInvoiceCreated') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Completed services cannot be cancelled.'
        });
      }
      if (order.invoice_id) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'This service cannot be cancelled because an invoice has already been generated.'
        });
      }
    }

    // TRANSITION LOGIC
    if (['Pending', 'Assigned', 'On Hold', 'Waiting for Customer'].includes(oldStatus) && status === 'In Progress') {
      // Start Service
      updates.started_at = order.started_at || new Date();
      if (!order.assigned_user_id) {
        const userId = await resolveAssignee(req.user.id, req.user.tenant_id, transaction);
        Object.assign(updates, await recordAssignment(order, userId, req.user, 'Started', transaction));
      }

    } else if (oldStatus === 'In Progress' && status === 'Completed') {
      // Complete Service — check invoice to determine which completed stage
      updates.status = order.invoice_id ? 'CompletedInvoiceCreated' : 'CompletedInvoicePending';
      updates.completed_at = new Date();
      updates.completed_by_user_id = order.assigned_user_id || req.user.id;

      // Wallet or Supplier deduction logic for Service Completion
      const {deductionPoint,completionCost}=require('../utils/serviceCompletionCost');
      const policy=await deductionPoint(order.tenant_id,transaction);
      if(!order.is_cost_deducted && policy==='invoice_creation' && (wallet_id || cost_supplier_id))throw Object.assign(new Error('Cost deduction is configured for invoice creation. Refresh the service.'),{status:409});
      if (policy==='service_completion' && !order.is_cost_deducted) {
        const cost=await completionCost(order,transaction);
        const totalCost=cost.amount,serviceName=cost.name;
        if(totalCost===0 && req.body.confirm_zero_cost!==true)throw Object.assign(new Error('No service cost is configured. Confirm this is a zero-cost service, or correct the cost before completing.'),{status:400});

        if (totalCost > 0) {
          const selectedType=cost_type || (wallet_id?'Wallet':cost_supplier_id?'Supplier':null);
          if(!['Wallet','Supplier'].includes(selectedType) || (selectedType==='Wallet' && (!wallet_id || cost_supplier_id)) || (selectedType==='Supplier' && (!cost_supplier_id || wallet_id)))throw Object.assign(new Error('Select a wallet or supplier for the service cost before completing.'),{status:400});
          const targetModel=selectedType==='Wallet'?require('../models').WalletAccount:require('../models').Supplier;
          const targetId=selectedType==='Wallet'?wallet_id:cost_supplier_id;
          if(!/^[1-9]\d*$/.test(String(targetId)))throw Object.assign(new Error('Choose a valid cost account.'),{status:400});
          const target=await targetModel.findOne({where:{id:targetId,tenant_id:order.tenant_id,is_active:true},transaction,lock:transaction.LOCK.UPDATE});
          if(!target)throw Object.assign(new Error('Choose an active wallet or supplier available in this workspace.'),{status:400});
          if(!canRecord(req.user,selectedType==='Wallet'?'wallet':'suppliers','edit',target))throw Object.assign(new Error('Your role cannot post a cost to the selected wallet or supplier.'),{status:403});
          if (selectedType === 'Supplier') {
            const { SupplierPurchase } = require('../models');
            await SupplierPurchase.create({
              tenant_id: req.user.tenant_id,
              supplier_id: cost_supplier_id,
              reference_type: 'ServiceOrder',
              reference_id: order.id,
              amount: totalCost,
              description: `Cost for Service #${order.id} - ${serviceName}`
            }, { transaction });
            updates.is_cost_deducted = true;
            updates.cost_type = 'Supplier';
            updates.cost_supplier_id = cost_supplier_id;
          } else if (wallet_id) {
            const { WalletTransaction, WalletAccount } = require('../models');
            await WalletTransaction.create({
              account_id: wallet_id,
              type: 'Expense',
              direction: 'Out',
              amount: totalCost,
              reference_id: order.id,
              reference_type: 'ServiceCost',
              description: `Cost payment for Service #${order.id} - ${serviceName}`,
              tenant_id: order.tenant_id
            }, { transaction });

            await WalletAccount.decrement('balance', {
              by: totalCost,
              where: { id: wallet_id, tenant_id:order.tenant_id },
              transaction
            });
            updates.is_cost_deducted = true;
            updates.cost_type = 'Wallet';
          }
        }
      }

    } else if (
      (oldStatus === 'CompletedInvoicePending' || oldStatus === 'CompletedInvoiceCreated') &&
      status === 'In Progress'
    ) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Completed services cannot be reverted.'
      });
    }

    await order.update(updates, { transaction });

    // Sync status to SalesOrderItem
    const salesOrderItem = await SalesOrderItem.findOne({
      where: { service_order_id: order.id, tenant_id: req.user.tenant_id },
      transaction
    });

    if (salesOrderItem) {
      const soiStatus = updates.status || status;
      await salesOrderItem.update({ status: soiStatus }, { transaction });
    }

    await transaction.commit();

    const updatedOrder = await ServiceOrder.findOne({
      where: { id: order.id, tenant_id: req.user.tenant_id },
      include: [
        { model: Customer, attributes: ['id', 'name', 'phone_whatsapp'] },
        ...staffInclude(req),
        { 
          model: ServiceType, 
          attributes: ['id', 'name', 'pricing_mode', 'cost_price'],
          include: [{ model: ServiceTypePricing }]
        },
        { model: Invoice, attributes: ['id', 'invoice_number', 'status'] }
      ]
    });

    let returnMessage = 'Status updated';
    if (oldStatus === 'In Progress' && status === 'Completed') {
      returnMessage = updatedOrder.status === 'CompletedInvoiceCreated'
        ? 'Service completed — invoice already exists.'
        : 'Service completed — waiting for invoice to be created.';
    }

    let deducted_wallet_name = '';
    if (updatedOrder.is_cost_deducted) {
      const { WalletTransaction, WalletAccount } = require('../models');
      const wt = await WalletTransaction.findOne({
        where: { reference_id: updatedOrder.id, reference_type: 'ServiceCost', tenant_id: req.user.tenant_id },
        include: [{ model: WalletAccount, attributes: ['name'] }]
      });
      if (wt && wt.WalletAccount) {
        deducted_wallet_name = wt.WalletAccount.name;
      }
    }

    const orderData = updatedOrder.toJSON();
    orderData.deducted_wallet_name = deducted_wallet_name;

    res.json({
      success: true,
      data: orderData,
      message: returnMessage
    });
  } catch (err) {
    if(!transaction.finished)await transaction.rollback();
    next(err);
  }
};


exports.deleteServiceOrder = async (req, res, next) => {
  try {
    const { Invoice, SalesOrderItem } = require('../models');
    const order = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (!['Pending', 'Cancelled'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only Pending or Cancelled orders can be deleted.' 
      });
    }

    // Dependency check: Invoices
    if (order.invoice_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete a Service Order that has an associated Invoice.' 
      });
    }

    // Dependency check: Sales Order
    const salesOrderItem = await SalesOrderItem.count({ where: { service_order_id: order.id, tenant_id: req.user.tenant_id } });
    if (salesOrderItem > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete a Service Order generated from a Sales Order. Cancel it instead.' 
      });
    }

    await order.destroy();
    res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
};

exports.updateServiceOrder = async (req, res, next) => {
  try {
    await sequelize.transaction(async transaction => {
      const order = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
      if (!['Pending', 'In Progress'].includes(order.status)) throw Object.assign(new Error('Only Pending or In Progress service orders can be edited.'), { status: 400 });
      const linkedInvoice = await Invoice.findOne({ where: { service_order_id: order.id, status: { [Op.ne]: 'Cancelled' }, tenant_id: req.user.tenant_id }, transaction });
      if (linkedInvoice) throw Object.assign(new Error('Cannot edit service order once an invoice is created.'), { status: 400 });
      const { customer_id, service_type_id, notes, criticality } = req.body;
      const updates = {};
      if (customer_id !== undefined) {
        if (!await Customer.findOne({ where: { id: customer_id, tenant_id: req.user.tenant_id }, transaction })) throw Object.assign(new Error('Invalid customer'), { status: 400 });
        updates.customer_id = customer_id;
      }
      if (service_type_id !== undefined) {
        if (!await ServiceType.findOne({ where: { id: service_type_id, tenant_id: req.user.tenant_id }, transaction })) throw Object.assign(new Error('Invalid service'), { status: 400 });
        updates.service_type_id = service_type_id;
      }
      if (notes !== undefined) updates.notes = notes;
      if (criticality !== undefined) { updates.criticality = criticality; updates.initial_criticality = criticality; }
      const userId = await resolveAssignee(req.body.assigned_user_id, req.user.tenant_id, transaction);
      if (userId !== undefined) Object.assign(updates, await recordAssignment(order, userId, req.user, 'Manual', transaction));
      await order.update(updates, { transaction });
    });
    const fullOrder = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id }, include: [
      { model: Customer, attributes: ['id', 'name', 'phone_whatsapp'] }, ...staffInclude(req),
      { model: ServiceType, attributes: ['id', 'name', 'pricing_mode', 'cost_price'], include: [{ model: ServiceTypePricing }] },
      { model: Invoice, attributes: ['id', 'invoice_number', 'status'] }
    ] });
    res.json({ success: true, data: fullOrder, message: 'Service order updated successfully' });
  } catch (error) { next(error); }
};

// Helper to generate Invoice Number (INV-YYYY-XXXX)
async function generateInvoiceNumber(transaction) {
  const year = new Date().getFullYear();
  const lastInvoice = await Invoice.findOne({
    where: {
      invoice_number: { [Op.like]: `INV-${year}-%` },
      tenant_id: req.user.tenant_id
    },
    order: [['invoice_number', 'DESC']],
    transaction
  });

  let nextNum = 1;
  if (lastInvoice) {
    const parts = lastInvoice.invoice_number.split('-');
    nextNum = parseInt(parts[2]) + 1;
  }
  
  return `INV-${year}-${nextNum.toString().padStart(4, '0')}`;
}

/**
 * CRITICALITY ESCALATION ENGINE
 * Runs through all active (Pending/In Progress) orders and escalates
 * criticality based on days elapsed since creation.
 */
exports.runEscalation = async (req, res, next) => {
  try {
    const SystemConfig = require('../models/SystemConfig');
    const tenantId = req.user?.tenant_id;
    const configs = await SystemConfig.findAll({
      where: {
        tenant_id: tenantId || null,
        key: [
          'svc_escalation_normal_to_moderate_days',
          'svc_escalation_normal_to_critical_days',
          'svc_escalation_moderate_to_critical_days'
        ]
      }
    });

    const cfg = {};
    configs.forEach(c => { cfg[c.key] = parseInt(c.value) || 0; });
    const normalToModerate   = cfg['svc_escalation_normal_to_moderate_days']   ?? 2;
    const normalToCritical   = cfg['svc_escalation_normal_to_critical_days']   ?? 4;
    const moderateToCritical = cfg['svc_escalation_moderate_to_critical_days'] ?? 2;

    // Fetch all active orders
    const activeOrders = await ServiceOrder.findAll({
      where: { tenant_id: tenantId, status: { [Op.in]: ['Pending', 'In Progress'] } }
    });

    let escalatedCount = 0;
    const now = new Date();

    for (const order of activeOrders) {
      const daysElapsed = Math.floor((now - new Date(order.created_at)) / (1000 * 60 * 60 * 24));
      let newCriticality = order.criticality;
      const init = order.initial_criticality;

      if (init === 'Critical') {
        // Critical stays Critical
        newCriticality = 'Critical';
      } else if (init === 'Moderate') {
        if (daysElapsed >= moderateToCritical) newCriticality = 'Critical';
        else newCriticality = 'Moderate';
      } else { // Normal
        if (daysElapsed >= normalToCritical)       newCriticality = 'Critical';
        else if (daysElapsed >= normalToModerate)  newCriticality = 'Moderate';
        else                                       newCriticality = 'Normal';
      }

      if (newCriticality !== order.criticality) {
        await order.update({ criticality: newCriticality });
        escalatedCount++;
      }
    }

    res.json({ success: true, message: `Escalation complete. ${escalatedCount} order(s) updated.`, escalatedCount });
  } catch (err) {
    next(err);
  }
};

/**
 * GET Criticality Escalation Config
 */
exports.getCriticalityConfig = async (req, res, next) => {
  try {
    const SystemConfig = require('../models/SystemConfig');
    const configs = await SystemConfig.findAll({
      where: {
        tenant_id: req.user?.tenant_id || null,
        key: [
          'svc_escalation_normal_to_moderate_days',
          'svc_escalation_normal_to_critical_days',
          'svc_escalation_moderate_to_critical_days',
          'service_footer_colors'
        ]
      }
    });
    const result = {};
    configs.forEach(c => {
      if(c.key==='service_footer_colors'){try{result[c.key]=JSON.parse(c.value);}catch{}}
      else result[c.key] = parseInt(c.value);
    });
    result.service_footer_colors=require('../utils/serviceAppearance').colors(result.service_footer_colors);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT Criticality Escalation Config
 */
exports.saveCriticalityConfig = async (req, res, next) => {
  try {
    const SystemConfig = require('../models/SystemConfig');
    const keys = [
      'svc_escalation_normal_to_moderate_days',
      'svc_escalation_normal_to_critical_days',
      'svc_escalation_moderate_to_critical_days'
    ];
    const updates=[];
    for (const key of keys) {
      if (req.body[key] !== undefined) {
        const value=Number(req.body[key]);
        if(!Number.isSafeInteger(value) || value<1)return res.status(400).json({success:false,message:'Escalation days must be positive whole numbers.'});
        updates.push({key,value:String(value),tenant_id:req.user.tenant_id});
      }
    }
    if(req.body.service_footer_colors!==undefined){
      let palette;
      try{palette=require('../utils/serviceAppearance').colors(req.body.service_footer_colors,true);}catch(error){return res.status(400).json({success:false,message:error.message});}
      updates.push({key:'service_footer_colors',value:JSON.stringify(palette),tenant_id:req.user.tenant_id});
    }
    await sequelize.transaction(async transaction=>{for(const update of updates)await SystemConfig.upsert(update,{transaction});});
    res.json({ success: true, message: 'Criticality config saved' });
  } catch (err) {
    next(err);
  }
};

exports.incrementReminderCount = async (req, res, next) => {
  try {
    const order = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user?.Role?.type === 'CustomerPortal') {
      const userCustomerIds = req.user.LinkedCustomers?.map(c => c.id) || [];
      if (!userCustomerIds.includes(parseInt(order.customer_id))) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    order.reminder_count = (order.reminder_count || 0) + 1;
    await order.save();

    res.json({ success: true, reminder_count: order.reminder_count });
  } catch (err) {
    next(err);
  }
};

exports.markFollowUpDone = async (req, res, next) => {
  try {
    const { ServiceOrder } = require('../models');
    const order = await ServiceOrder.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    await order.update({ is_follow_up_done: true });
    res.json({ success: true, message: 'Follow up marked as done' });
  } catch (err) {
    next(err);
  }
};
