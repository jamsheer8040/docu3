const { User, Role, Customer, StaffDocument, DocumentType } = require('../models');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const staffSalary=require('../utils/staffSalary');

// Multer Storage Config for Avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/avatars';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

exports.upload = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const meta = allowed.test(file.mimetype);
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (meta && ext) return cb(null, true);
    cb(new Error('Only images (jpg, png, webp) are allowed.'));
  }
});

const hasStaffPermission = (reqUser, action = 'read') => {
  if (!reqUser || !reqUser.Role) return false;
  if (reqUser.Role.name === 'Admin' || reqUser.Role.name === 'Developer') return true;
  let perms = reqUser.Role.permissions;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch (e) { perms = {}; }
  }
  return !!(perms && perms.staff && perms.staff[action]);
};

exports.getUsers = async (req, res) => {
  try {
    const where = { tenant_id: req.user.tenant_id };
    if (req.user?.Role?.name !== 'Developer') {
      where['$Role.name$'] = { [require('sequelize').Op.ne]: 'Developer' };
    }

    const canViewStaff = hasStaffPermission(req.user, 'read');
    const excludeAttrs = ['password_hash'];
    if (!canViewStaff) {
      excludeAttrs.push('basic_salary', 'hr_allowance', 'other_allowances', 'total_salary');
    }

    const includes = [
      { model: Role, attributes: ['name', 'permissions', 'type'] },
      { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] }
    ];

    if (canViewStaff) {
      includes.push({
        model: StaffDocument,
        as: 'StaffDocuments',
        attributes: ['id', 'expiry_date', 'document_type_id']
      });
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: excludeAttrs },
      include: includes,
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[User Controller] getUsers error:', err);
    res.status(500).json({ success: false, message: 'Error fetching users.' });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const canViewStaff = hasStaffPermission(req.user, 'read');

    const includes = [
      { model: Role, attributes: ['id', 'name', 'permissions', 'type'] },
      { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] }
    ];

    if (canViewStaff) {
      includes.push({
        model: StaffDocument,
        as: 'StaffDocuments',
        include: [{ model: DocumentType, as: 'DocumentType', attributes: ['id', 'name', 'category'] }]
      });
    }

    const user = await User.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      attributes: { exclude: ['password_hash'] },
      include: includes,
      order: canViewStaff ? [
        [{ model: StaffDocument, as: 'StaffDocuments' }, 'expiry_date', 'ASC']
      ] : undefined
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const userData = user.toJSON();
    if (!canViewStaff) {
      userData.basic_salary = 0;
      userData.hr_allowance = 0;
      userData.other_allowances = 0;
      userData.total_salary = 0;
      userData.StaffDocuments = [];
    }

    res.json({ success: true, data: userData });
  } catch (err) {
    console.error('[User Controller] getUserById error:', err);
    res.status(500).json({ success: false, message: 'Error fetching user details.' });
  }
};

exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      name, email, password, role_id, customer_ids, can_login,
      phone, address, home_country_address, home_country_contact, home_country_alternate_contact,
      designation, joining_date, basic_salary, hr_allowance, other_allowances, total_salary
    } = req.body;

    const canLoginBool = can_login !== undefined ? (can_login === true || can_login === 'true') : true;

    if (canLoginBool && (!email || !password)) {
      return res.status(400).json({ success: false, message: 'Email and password are required for accounts with system login access.' });
    }

    const cleanEmail = (email && typeof email === 'string' && email.trim()) ? email.trim() : null;
    const cleanPassword = canLoginBool ? password : null;

    const canEditStaff = hasStaffPermission(req.user, 'write');
    const salary=staffSalary(canEditStaff?{basic_salary,hr_allowance,other_allowances,total_salary}:{});

    const user = await User.create({
      name,
      email: cleanEmail,
      password_hash: cleanPassword, // hooks hash it if provided
      can_login: canLoginBool,
      role_id: canLoginBool ? role_id : (role_id || null),
      phone: phone || null,
      address: address || null,
      home_country_address: home_country_address || null,
      home_country_contact: home_country_contact || null,
      home_country_alternate_contact: home_country_alternate_contact || null,
      designation: designation || null,
      joining_date: joining_date || null,
      ...salary,
      tenant_id: req.user.tenant_id
    });

    if (role_id && customer_ids && Array.isArray(customer_ids)) {
      await user.setLinkedCustomers(customer_ids);
    }

    const canViewStaff = hasStaffPermission(req.user, 'read');
    const populated = await User.findByPk(user.id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: Role, attributes: ['name', 'permissions', 'type'] },
        { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] },
        ...(canViewStaff ? [{
          model: StaffDocument,
          as: 'StaffDocuments',
          include: [{ model: DocumentType, as: 'DocumentType', attributes: ['id', 'name', 'category'] }]
        }] : [])
      ]
    });

    const populatedData = populated.toJSON();
    if (!canViewStaff) {
      populatedData.basic_salary = 0;
      populatedData.hr_allowance = 0;
      populatedData.other_allowances = 0;
      populatedData.total_salary = 0;
      populatedData.StaffDocuments = [];
    }

    res.status(201).json({ success: true, data: populatedData });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'Email already in use.' });
    }
    console.error('[User Controller] createUser error:', err);
    res.status(err.status||500).json({ success: false, message: err.status===400?err.message:'Error creating user.' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const {
      name, email, password, role_id, customer_ids, is_active, can_login,
      phone, address, home_country_address, home_country_contact, home_country_alternate_contact,
      designation, joining_date, basic_salary, hr_allowance, other_allowances, total_salary
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = (email && typeof email === 'string' && email.trim()) ? email.trim() : null;
    if (role_id !== undefined) updateData.role_id = role_id;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (can_login !== undefined) updateData.can_login = (can_login === true || can_login === 'true');
    if (password) updateData.password_hash = password;

    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (home_country_address !== undefined) updateData.home_country_address = home_country_address;
    if (home_country_contact !== undefined) updateData.home_country_contact = home_country_contact;
    if (home_country_alternate_contact !== undefined) updateData.home_country_alternate_contact = home_country_alternate_contact;
    if (designation !== undefined) updateData.designation = designation;
    if (joining_date !== undefined) updateData.joining_date = joining_date || null;

    const canEditStaff = hasStaffPermission(req.user, 'write');
    if(canEditStaff)Object.assign(updateData,staffSalary({basic_salary,hr_allowance,other_allowances,total_salary},user));

    await user.update(updateData);
    
    if (role_id && customer_ids && Array.isArray(customer_ids)) {
      await user.setLinkedCustomers(customer_ids);
    } else if (!role_id || !customer_ids || customer_ids.length === 0) {
      await user.setLinkedCustomers([]);
    }
    
    const canViewStaff = hasStaffPermission(req.user, 'read');
    const populated = await User.findByPk(user.id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: Role, attributes: ['name', 'permissions', 'type'] },
        { model: Customer, as: 'LinkedCustomers', attributes: ['id', 'name'] },
        ...(canViewStaff ? [{
          model: StaffDocument,
          as: 'StaffDocuments',
          include: [{ model: DocumentType, as: 'DocumentType', attributes: ['id', 'name', 'category'] }]
        }] : [])
      ]
    });

    const populatedData = populated.toJSON();
    if (!canViewStaff) {
      populatedData.basic_salary = 0;
      populatedData.hr_allowance = 0;
      populatedData.other_allowances = 0;
      populatedData.total_salary = 0;
      populatedData.StaffDocuments = [];
    }

    res.json({ success: true, data: populatedData });
  } catch (err) {
    console.error('[User Controller] updateUser error:', err);
    res.status(err.status||500).json({ success: false, message: err.status===400?err.message:'Error updating user.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Prevent deleting the primary admin account
    if (user.id === 1 || user.Role?.name === 'Admin') {
        return res.status(400).json({ success: false, message: 'The primary administrator account cannot be deleted.' });
    }

    // Prevent deleting self
    if (user.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'You cannot delete yourself.' });
    }

    await user.destroy();
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    console.error('[User Controller] deleteUser error:', err);
    res.status(500).json({ success: false, message: 'Error deleting user.' });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const user = await User.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await user.update({ avatar: avatarUrl });

    res.json({ 
      success: true, 
      message: 'Avatar uploaded successfully.',
      avatar: avatarUrl
    });
  } catch (err) {
    console.error('[User Controller] Avatar Upload Error:', err);
    res.status(500).json({ success: false, message: 'Avatar upload failed.' });
  }
};

// ─── Staff Document Management ──────────────────────────────────────────────
exports.addStaffDocument = async (req, res) => {
  try {
    const user = await User.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { document_type_id, title, doc_number, issue_date, expiry_date, notes } = req.body;
    if (!expiry_date) {
      return res.status(400).json({ success: false, message: 'Expiry date is required.' });
    }

    const filePath = req.file ? `/uploads/documents/${req.file.filename}` : null;

    const doc = await StaffDocument.create({
      user_id: user.id,
      document_type_id: document_type_id ? parseInt(document_type_id) : null,
      title: title || null,
      doc_number: doc_number || null,
      issue_date: issue_date || null,
      expiry_date,
      file_path: filePath,
      notes: notes || null,
      tenant_id: req.user.tenant_id
    });

    const populated = await StaffDocument.findByPk(doc.id, {
      include: [{ model: DocumentType, as: 'DocumentType', attributes: ['id', 'name', 'category'] }]
    });

    res.status(201).json({ success: true, message: 'Document added successfully.', data: populated });
  } catch (err) {
    console.error('[User Controller] addStaffDocument error:', err);
    res.status(500).json({ success: false, message: 'Failed to add staff document.' });
  }
};

exports.updateStaffDocument = async (req, res) => {
  try {
    const doc = await StaffDocument.findOne({
      where: { id: req.params.docId, user_id: req.params.id, tenant_id: req.user.tenant_id }
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Staff document not found.' });
    }

    const { document_type_id, title, doc_number, issue_date, expiry_date, notes } = req.body;
    const updateData = {};
    if (document_type_id !== undefined) updateData.document_type_id = document_type_id ? parseInt(document_type_id) : null;
    if (title !== undefined) updateData.title = title;
    if (doc_number !== undefined) updateData.doc_number = doc_number;
    if (issue_date !== undefined) updateData.issue_date = issue_date || null;
    if (expiry_date) updateData.expiry_date = expiry_date;
    if (notes !== undefined) updateData.notes = notes;

    if (req.file) {
      if (doc.file_path) {
        const oldPath = path.join('.', doc.file_path);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (e) {}
        }
      }
      updateData.file_path = `/uploads/documents/${req.file.filename}`;
    }

    await doc.update(updateData);

    const populated = await StaffDocument.findByPk(doc.id, {
      include: [{ model: DocumentType, as: 'DocumentType', attributes: ['id', 'name', 'category'] }]
    });

    res.json({ success: true, message: 'Document updated successfully.', data: populated });
  } catch (err) {
    console.error('[User Controller] updateStaffDocument error:', err);
    res.status(500).json({ success: false, message: 'Failed to update staff document.' });
  }
};

exports.deleteStaffDocument = async (req, res) => {
  try {
    const doc = await StaffDocument.findOne({
      where: { id: req.params.docId, user_id: req.params.id, tenant_id: req.user.tenant_id }
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Staff document not found.' });
    }

    if (doc.file_path) {
      const filePath = path.join('.', doc.file_path);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
    }

    await doc.destroy();
    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('[User Controller] deleteStaffDocument error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete staff document.' });
  }
};
