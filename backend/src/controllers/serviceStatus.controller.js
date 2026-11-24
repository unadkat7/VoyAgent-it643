import { getServiceStatus, updateServiceStatus } from "../services/serviceStatus.service.js";

export const getStatus = async (req, res) => {
  const status = await getServiceStatus();
  res.set("Cache-Control", "no-store");
  res.status(200).json({ success: true, status });
};

export const putStatus = async (req, res) => {
  const status = await updateServiceStatus({
    ...req.body,
    adminId: req.user._id,
  });
  res.set("Cache-Control", "no-store");
  res.status(200).json({ success: true, status });
};
