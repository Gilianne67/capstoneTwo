const CategoryDemandEvent = require('../models/CategoryDemandEvent');
const { createDemandRecorder } = require('../services/categoryDemandService');

const recordDemand = createDemandRecorder({
  insertMany: (docs) => CategoryDemandEvent.insertMany(docs),
});

exports.recordFilterDemand = async (req, res) => {
  try {
    const result = await recordDemand({
      userId: req.user && (req.user._id || req.user.id),
      body: req.body,
    });
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }
    return res.status(200).json({
      success: true,
      recorded: result.recorded,
      skippedDuplicates: result.skippedDuplicates,
    });
  } catch (error) {
    console.error('Filter demand recording failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to record the filter selection.',
    });
  }
};
