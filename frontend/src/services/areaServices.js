import apiClient from "./services.js";

export default {
  getAreas() {
    return apiClient.get("areas");
  },
  getMyAreas() {
    return apiClient.get("areas/mine");
  },
  createArea(area) {
    return apiClient.post("areas", area);
  },
  updateArea(areaId, area) {
    return apiClient.put(`areas/${areaId}`, area);
  },
  assignAdmin(areaId, userId) {
    return apiClient.post(`areas/${areaId}/admins`, { userId });
  },
  removeAdmin(areaId, userId) {
    return apiClient.delete(`areas/${areaId}/admins/${userId}`);
  },
};
