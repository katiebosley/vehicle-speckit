import apiClient from "./services.js";

const vehicleServices = {
  list(params) {
    return apiClient.get("vehicles", { params });
  },

  get(id) {
    return apiClient.get(`vehicles/${id}`);
  },

  create(vehicle) {
    return apiClient.post("vehicles", vehicle);
  },

  update(id, vehicle) {
    return apiClient.put(`vehicles/${id}`, vehicle);
  },

  addBlock(id, window) {
    return apiClient.post(`vehicles/${id}/unavailability`, window);
  },

  removeBlock(id, windowId) {
    return apiClient.delete(`vehicles/${id}/unavailability/${windowId}`);
  },
};

export default vehicleServices;
