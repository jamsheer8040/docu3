const cvOwner = req => require('../utils/permissionRules').hasScopedRules(req.user.Role?.permissions) ? {} : { user_id: req.user.id };
const { SavedCv, User } = require('../models');
const { Op } = require('sequelize');

// Get all saved CVs for the current user and tenant, within the last 30 days
exports.getSavedCvs = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const cvs = await SavedCv.findAll({
            where: {
                tenant_id: req.user.tenant_id,
                ...cvOwner(req),
                created_at: {
                    [Op.gte]: thirtyDaysAgo
                }
            },
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, data: cvs });
    } catch (err) {
        console.error('getSavedCvs Error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch saved CVs' });
    }
};

// Get a specific saved CV
exports.getSavedCv = async (req, res) => {
    try {
        const cv = await SavedCv.findOne({
            where: {
                id: req.params.id,
                tenant_id: req.user.tenant_id,
                ...cvOwner(req)
            }
        });
        if (!cv) {
            return res.status(404).json({ success: false, message: 'CV not found' });
        }
        res.json({ success: true, data: cv });
    } catch (err) {
        console.error('getSavedCv Error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch saved CV' });
    }
};

// Create a new saved CV
exports.createSavedCv = async (req, res) => {
    try {
        const { name, profession, template, data } = req.body;
        
        const newCv = await SavedCv.create({
            name: name || 'Untitled CV',
            profession: profession || '',
            template: template || 'TemplateOne',
            data: data || {},
            tenant_id: req.user.tenant_id,
            user_id: req.user.id
        });

        res.status(201).json({ success: true, message: 'CV saved successfully', data: newCv });
    } catch (err) {
        console.error('createSavedCv Error:', err);
        res.status(500).json({ success: false, message: 'Failed to save CV' });
    }
};

// Update an existing saved CV
exports.updateSavedCv = async (req, res) => {
    try {
        const { name, profession, template, data } = req.body;

        const cv = await SavedCv.findOne({
            where: {
                id: req.params.id,
                tenant_id: req.user.tenant_id,
                ...cvOwner(req)
            }
        });

        if (!cv) {
            return res.status(404).json({ success: false, message: 'CV not found' });
        }

        cv.name = name || cv.name;
        cv.profession = profession || cv.profession;
        cv.template = template || cv.template;
        cv.data = data || cv.data;
        await cv.save();

        res.json({ success: true, message: 'CV updated successfully', data: cv });
    } catch (err) {
        console.error('updateSavedCv Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update CV' });
    }
};

// Delete a saved CV
exports.deleteSavedCv = async (req, res) => {
    try {
        const cv = await SavedCv.findOne({
            where: {
                id: req.params.id,
                tenant_id: req.user.tenant_id,
                ...cvOwner(req)
            }
        });

        if (!cv) {
            return res.status(404).json({ success: false, message: 'CV not found' });
        }

        await cv.destroy();
        res.json({ success: true, message: 'CV deleted successfully' });
    } catch (err) {
        console.error('deleteSavedCv Error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete CV' });
    }
};
