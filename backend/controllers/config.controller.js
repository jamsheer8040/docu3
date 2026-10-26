const { SystemConfig } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Storage Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/branding';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

exports.upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|svg|webp/;
    const meta = allowed.test(file.mimetype);
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (meta && ext) return cb(null, true);
    cb(new Error('Only images (jpg, png, svg, webp) are allowed.'));
  }
});

exports.getConfigs = async (req, res) => {
  try {
    // Fetch global configs and tenant specific configs
    const globalConfigs = await SystemConfig.findAll({ where: { tenant_id: null } }) || [];
    const tenantConfigs = req.user?.tenant_id ? await SystemConfig.findAll({ where: { tenant_id: req.user.tenant_id } }) : [];

    // Merge them, giving precedence to tenant configs (tenant overrides global)
    const configs = [...globalConfigs];
    tenantConfigs.forEach(tc => {
      const idx = configs.findIndex(c => c.key === tc.key);
      if (idx > -1) configs[idx] = tc;
      else configs.push(tc);
    });
    const configMap = { theme_name: 'sage', commission_enabled: true };
    configs.forEach(c => {
      try {
        configMap[c.key] = JSON.parse(c.value);
      } catch (e) {
        configMap[c.key] = c.value;
      }
    });
    configMap.commission_enabled=await require('../utils/commissionFeature').isEnabled(req.user?.tenant_id);
    res.json({ success: true, data: configMap });
  } catch (err) {
    console.error('[Config Controller] Read failed:', err);
    res.status(500).json({ success: false, message: 'Configuration could not be loaded. Please retry.' });
  }
};

exports.updateConfigs = async (req, res) => {
  try {
    const settings = req.body;
    if (['commission_enabled','commission_activation'].some(key=>Object.prototype.hasOwnProperty.call(settings,key))) {
      return res.status(400).json({success:false,message:'Use the confirmed commission master switch to change commission availability.'});
    }
    if (Object.prototype.hasOwnProperty.call(settings, 'proposed_company_capital')) {
      try { require('../utils/managementFinance').units(settings.proposed_company_capital, 'Company capital', true); }
      catch (error) { return res.status(400).json({ success: false, message: error.message }); }
    }

    for (const [key, value] of Object.entries(settings)) {
      await SystemConfig.upsert({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        tenant_id: req.user.tenant_id
      });
    }

    res.json({ success: true, message: 'Configuration updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating configuration.' });
  }
};

exports.setCommissionEnabled = async (req,res) => {
  try {
    if (typeof req.body.enabled !== 'boolean' || req.body.confirmed !== true || typeof req.body.expected_enabled !== 'boolean') {
      return res.status(400).json({success:false,message:'Confirm the commission switch change before saving.'});
    }
    const {sequelize,Tenant}=require('../models');
    await sequelize.transaction(async transaction=>{
      const tenant_id=req.user.tenant_id;
      if(!tenant_id)throw Object.assign(new Error('Select a workspace.'),{status:400});
      await Tenant.findOne({where:{id:tenant_id},transaction,lock:transaction.LOCK.UPDATE});
      const current=await require('../utils/commissionFeature').isEnabled(tenant_id,transaction);
      if(current!==req.body.expected_enabled && current!==req.body.enabled)throw Object.assign(new Error('Commission setting changed. Refresh before trying again.'),{status:409});
      if(req.body.enabled) await require('../utils/commissionFeature').activate(tenant_id,transaction,{replace:!current});
      if(!req.body.enabled){
        const {CommissionEntry,CommissionPayment}=require('../models');
        const entries=await CommissionEntry.findAll({where:{tenant_id,voided_at:null},transaction,lock:transaction.LOCK.UPDATE});
        const pending=entries.filter(entry=>!['Approved','Rejected'].includes(entry.approval_status));
        const approved=entries.filter(entry=>entry.approval_status==='Approved');
        const {Op}=require('sequelize');
        const payments=approved.length?await CommissionPayment.findAll({where:{tenant_id,entry_id:{[Op.in]:approved.map(entry=>entry.id)},reversed_at:null},transaction}):[];
        const unpaid=approved.filter(entry=>payments.filter(payment=>payment.entry_id===entry.id).reduce((sum,payment)=>sum+Math.round(Number(payment.amount)*100),0)<Math.round(Number(entry.amount)*100));
        if(pending.length || unpaid.length)throw Object.assign(new Error(`Cannot disable commission: ${pending.length} pending approval and ${unpaid.length} approved commission balance(s) remain. Review and fully settle these first.`),{status:409});
      }
      const where={tenant_id,key:'commission_enabled'};
      const [row]=await SystemConfig.findOrCreate({where,defaults:{...where,value:'true'},transaction});
      await row.update({value:JSON.stringify(req.body.enabled)},{transaction});
    });
    res.json({success:true,data:{commission_enabled:req.body.enabled}});
  } catch(error) { res.status(error.status || 500).json({success:false,message:error.status?error.message:'Unable to change commission availability.'}); }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const logoUrl = `/uploads/branding/${req.file.filename}`;

    // Auto-update config for this tenant
    await SystemConfig.upsert({
      key: 'app_logo',
      value: logoUrl,
      tenant_id: req.user.tenant_id
    });

    res.json({
      success: true,
      message: 'Logo uploaded successfully.',
      url: logoUrl
    });
  } catch (err) {
    console.error('[Config Controller] Upload Error:', err);
    res.status(500).json({ success: false, message: 'Logo upload failed.' });
  }
};
