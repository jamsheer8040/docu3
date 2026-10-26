const { Role, User } = require('../models');
const { normalizePermissions } = require('../utils/permissionRules');

exports.getRoles = async (req, res) => {
  try {
    const where = {
      tenant_id: { [require('sequelize').Op.or]: [null, req.user.tenant_id] }
    };
    if (req.user?.Role?.name !== 'Developer') {
      where.name = { [require('sequelize').Op.ne]: 'Developer' };
    }

    // 1. Fetch all roles
    const roles = await Role.findAll({
      where,
      order: [['name', 'ASC']]
    });

    // 2. Fetch User counts per role
    const userCounts = await require('../utils/recordAccess').internalRead(() => User.findAll({
        where: { tenant_id: req.user.tenant_id },
        attributes: [
            'role_id',
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['role_id'],
        raw: true
    }));

    // 3. Map counts back to role objects
    const data = roles.map(role => {
        const roleJson = role.toJSON();
        if (typeof roleJson.permissions === 'string') {
          try { roleJson.permissions = JSON.parse(roleJson.permissions); } catch (e) { roleJson.permissions = {}; }
        }
        const countData = userCounts.find(uc => uc.role_id === role.id);
        roleJson.UserCount = countData ? parseInt(countData.count) : 0;
        
        // ULTIMATE GUARD: Force Admin to Full Access at the SDK level
        if (roleJson.name === 'Admin') {
            roleJson.permissions = {
                dashboard: { read: true, write: true, delete: true },
                customers: { read: true, write: true, delete: true },
                documents: { read: true, write: true, delete: true },
                services: { read: true, write: true, delete: true },
                invoices: { read: true, write: true, delete: true },
                expenses: { read: true, write: true, delete: true },
                wallet: { read: true, write: true, delete: true },
                reports: { read: true, write: true, delete: true },
                settings: { read: true, write: true, delete: true },
                financials: { read: true, write: true, delete: true },
                staff: { read: true, write: true, delete: true }
            };
        } else if (roleJson.type === 'CustomerPortal') {
            // Customer Portal roles can only have documents permissions
            const docsPerms = roleJson.permissions?.documents || { read: false, write: false, delete: false };
            roleJson.permissions = {
                dashboard: { read: false, write: false, delete: false },
                customers: { read: false, write: false, delete: false },
                documents: {
                    read: docsPerms.read === true,
                    write: docsPerms.write === true,
                    delete: docsPerms.delete === true
                },
                services: { read: false, write: false, delete: false },
                invoices: { read: false, write: false, delete: false },
                expenses: { read: false, write: false, delete: false },
                wallet: { read: false, write: false, delete: false },
                reports: { read: false, write: false, delete: false },
                settings: { read: false, write: false, delete: false },
                financials: { read: false, write: false, delete: false },
                staff: { read: false, write: false, delete: false }
            };
        }
        return roleJson;
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[Role Controller] Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching roles.' });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const role = await Role.findOne({ where: { id: req.params.id, tenant_id: { [Op.or]: [null, req.user.tenant_id] }, ...(req.user.Role?.name === 'Developer' ? {} : { name: { [Op.ne]: 'Developer' } }) } });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    res.json({ success: true, data: role });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching role.' });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, type = 'Internal', permissions } = req.body;
    if (!name?.trim() || ['admin', 'developer'].includes(name.trim().toLowerCase()) || !['Internal', 'CustomerPortal'].includes(type)) return res.status(400).json({ success: false, message: 'Choose a valid, non-system role name and type.' });
    if (permissions) { try { normalizePermissions(permissions); } catch (error) { return res.status(400).json({ success: false, message: error.message }); } }
    let finalPerms = permissions || {
      dashboard: { read: type === 'Internal', write: type === 'Internal', delete: type === 'Internal' },
      customers: { read: false, write: false, delete: false },
      documents: { read: false, write: false, delete: false },
      services: { read: false, write: false, delete: false },
      invoices: { read: false, write: false, delete: false },
      expenses: { read: false, write: false, delete: false },
      wallet: { read: false, write: false, delete: false },
      reports: { read: false, write: false, delete: false },
      settings: { read: false, write: false, delete: false },
      financials: { read: false, write: false, delete: false },
      staff: { read: false, write: false, delete: false }
    };

    if (type === 'CustomerPortal') {
      const docsPerms = finalPerms.documents || { read: false, write: false, delete: false };
      finalPerms = {
        dashboard: { read: false, write: false, delete: false },
        customers: { read: false, write: false, delete: false },
        documents: {
          read: docsPerms.read === true,
          write: docsPerms.write === true,
          delete: docsPerms.delete === true
        },
        services: { read: false, write: false, delete: false },
        invoices: { read: false, write: false, delete: false },
        expenses: { read: false, write: false, delete: false },
        wallet: { read: false, write: false, delete: false },
        reports: { read: false, write: false, delete: false },
        settings: { read: false, write: false, delete: false },
        financials: { read: false, write: false, delete: false },
        staff: { read: false, write: false, delete: false }
      };
    }

    let dashboard_template_id;
    try { dashboard_template_id=await require('../utils/dashboardTemplates').templateId(req.body.dashboard_template_id,req.user.tenant_id,type); }
    catch(error){return res.status(400).json({success:false,message:error.message});}
    const role = await Role.create({ name: name.trim(), type, permissions: normalizePermissions(finalPerms), tenant_id: req.user.tenant_id, dashboard_template_id });
    res.status(201).json({ success: true, data: role });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating role.' });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = Object.fromEntries(['name', 'type', 'permissions'].filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
    
    console.log(`[Role Controller] Attempting update for Role ID: ${id}`);
    
    const role = await Role.findOne({ where: { id, tenant_id: req.user.tenant_id } });
    if (!role) {
      console.warn(`[Role Controller] Role ID: ${id} not found.`);
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }
    if (['Admin', 'Developer'].includes(role.name)) return res.status(400).json({ success: false, message: 'System administrator permissions are fixed.' });
    if (updateData.name && ['admin', 'developer'].includes(updateData.name.trim().toLowerCase())) return res.status(400).json({ success: false, message: 'System role names are reserved.' });
    if (updateData.type && !['Internal', 'CustomerPortal'].includes(updateData.type)) return res.status(400).json({ success: false, message: 'Invalid role type.' });
    if (updateData.permissions) { try { updateData.permissions = normalizePermissions(updateData.permissions); } catch (error) { return res.status(400).json({ success: false, message: error.message }); } }

    // PROTECT SYSTEM ROLES FROM RENAME
    if ((role.name === 'Admin' || role.name === 'Staff') && updateData.name && updateData.name !== role.name) {
        return res.status(400).json({ success: false, message: 'System role names cannot be changed.' });
    }

    // Sanitize permissions for CustomerPortal type roles
    const currentType = updateData.type || role.type;
    if (updateData.permissions && currentType === 'CustomerPortal') {
      const docsPerms = updateData.permissions.documents || { read: false, write: false, delete: false };
      updateData.permissions = {
        dashboard: { read: false, write: false, delete: false },
        customers: { read: false, write: false, delete: false },
        documents: {
          read: docsPerms.read === true,
          write: docsPerms.write === true,
          delete: docsPerms.delete === true
        },
        services: { read: false, write: false, delete: false },
        invoices: { read: false, write: false, delete: false },
        expenses: { read: false, write: false, delete: false },
        wallet: { read: false, write: false, delete: false },
        reports: { read: false, write: false, delete: false },
        settings: { read: false, write: false, delete: false },
        financials: { read: false, write: false, delete: false },
        staff: { read: false, write: false, delete: false }
      };
    }

    // Force permissions update if present
    if (updateData.permissions) {
      console.log(`[Role Controller] Updating permissions for ${role.name}:`, JSON.stringify(updateData.permissions).substring(0, 50) + '...');
      role.permissions = updateData.permissions;
      role.changed('permissions', true);
    }

    const { id: roleId, tenant_id, ...safePayload } = updateData;
    await role.update(safePayload);
    console.log(`[Role Controller] Role ${role.name} updated successfully.`);
    res.json({ success: true, data: role });
  } catch (err) {
    console.error('[Role Controller] Update failed:', err);
    res.status(500).json({ success: false, message: 'Error updating role.' });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    // Prevent deletion of protected roles
    if (role.name === 'Admin' || role.name === 'Staff') {
        return res.status(400).json({ success: false, message: 'System roles cannot be deleted.' });
    }

    // CHECK FOR ASSIGNED USERS
    const userCount = await require('../utils/recordAccess').internalRead(() => User.count({ where: { role_id: role.id, tenant_id: req.user.tenant_id } }));
    if (userCount > 0) {
        return res.status(400).json({ success: false, message: `Cannot delete role "${role.name}" because it has ${userCount} users assigned.` });
    }

    await role.destroy();
    res.json({ success: true, message: 'Role deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting role.' });
  }
};
