const Taxonomy = require('../models/Taxonomy');
const { recordAuditLog } = require('./auditController');

/**
 * @desc    Get taxonomy tags with optional category filter & text search
 * @route   GET /api/v1/admin/taxonomy
 * @access  Private/Admin
 */
exports.getTaxonomyTags = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { aliases: searchRegex }
      ];
    }

    const tags = await Taxonomy.find(query).sort({ usageCount: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tags.length,
      data: tags
    });
  } catch (error) {
    console.error('Error fetching taxonomy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve taxonomy catalog',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new canonical taxonomy tag
 * @route   POST /api/v1/admin/taxonomy
 * @access  Private/Admin
 */
exports.createTaxonomyTag = async (req, res) => {
  try {
    const { name, category, aliases } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both tag name and category.'
      });
    }

    const existingTag = await Taxonomy.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: 'A taxonomy tag with this canonical name already exists.'
      });
    }

    const cleanedAliases = Array.isArray(aliases)
      ? Array.from(new Set(aliases.map(a => a.trim().toLowerCase()).filter(Boolean)))
      : [];

    const newTag = await Taxonomy.create({
      name: name.trim(),
      category,
      aliases: cleanedAliases
    });

    // 📝 AUDIT LOG: Taxonomy Tag Created
    const actorName = req.user ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email : 'Admin User';
    
    await recordAuditLog({
      actor: actorName,
      role: req.user ? req.user.role : 'Admin',
      action: 'TAXONOMY_CREATE',
      details: `Created new Taxonomy Tag: "${newTag.name}" (${newTag.category})`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(201).json({
      success: true,
      message: 'Taxonomy tag created successfully',
      data: newTag
    });
  } catch (error) {
    console.error('Error creating taxonomy tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create taxonomy tag',
      error: error.message
    });
  }
};

/**
 * @desc    Update canonical tag details, category, or aliases
 * @route   PATCH /api/v1/admin/taxonomy/:id
 * @access  Private/Admin
 */
exports.updateTaxonomyTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, aliases } = req.body;

    const tag = await Taxonomy.findById(id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Taxonomy tag not found'
      });
    }

    const previousName = tag.name;

    if (name) tag.name = name.trim();
    if (category) tag.category = category;
    if (Array.isArray(aliases)) {
      tag.aliases = Array.from(new Set(aliases.map(a => a.trim().toLowerCase()).filter(Boolean)));
    }

    const updatedTag = await tag.save();

    // 📝 AUDIT LOG: Taxonomy Tag Updated
    const actorName = req.user ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email : 'Admin User';

    await recordAuditLog({
      actor: actorName,
      role: req.user ? req.user.role : 'Admin',
      action: 'TAXONOMY_UPDATE',
      details: `Updated Taxonomy Tag: "${previousName}" -> "${updatedTag.name}" (${updatedTag.category})`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(200).json({
      success: true,
      message: 'Taxonomy tag updated successfully',
      data: updatedTag
    });
  } catch (error) {
    console.error('Error updating taxonomy tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update taxonomy tag',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a taxonomy tag
 * @route   DELETE /api/v1/admin/taxonomy/:id
 * @access  Private/Admin
 */
exports.deleteTaxonomyTag = async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await Taxonomy.findById(id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Taxonomy tag not found'
      });
    }

    if (tag.isSystem) {
      return res.status(403).json({
        success: false,
        message: 'System tags cannot be deleted.'
      });
    }

    const deletedTagName = tag.name;
    await Taxonomy.findByIdAndDelete(id);

    // 📝 AUDIT LOG: Taxonomy Tag Deleted
    const actorName = req.user ? `${req.user.firstName || req.user.name || ''} ${req.user.lastName || ''}`.trim() || req.user.email : 'Admin User';

    await recordAuditLog({
      actor: actorName,
      role: req.user ? req.user.role : 'Admin',
      action: 'TAXONOMY_DELETE',
      details: `Deleted Taxonomy Tag: "${deletedTagName}"`,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      severity: 'Info'
    });

    res.status(200).json({
      success: true,
      message: 'Taxonomy tag removed successfully'
    });
  } catch (error) {
    console.error('Error deleting taxonomy tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete taxonomy tag',
      error: error.message
    });
  }
};