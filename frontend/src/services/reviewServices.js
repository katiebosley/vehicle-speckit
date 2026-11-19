import apiClient from "./services.js";

const reviewServices = {
  list(status) {
    return apiClient.get("api/review/requests", { params: { status } });
  },

  availableVehicles(requestId) {
    return apiClient.get(`api/review/requests/${requestId}/available-vehicles`);
  },

  eligibleDrivers(requestId) {
    return apiClient.get(`api/review/requests/${requestId}/eligible-drivers`);
  },

  approve(requestId, body) {
    return apiClient.post(`api/review/requests/${requestId}/approve`, body);
  },

  deny(requestId, body) {
    return apiClient.post(`api/review/requests/${requestId}/deny`, body);
  },

  addAssignment(requestId, body) {
    return apiClient.post(`api/review/requests/${requestId}/assignments`, body);
  },

  updateAssignment(requestId, assignmentId, body) {
    return apiClient.put(`api/review/requests/${requestId}/assignments/${assignmentId}`, body);
  },

  removeAssignment(requestId, assignmentId) {
    return apiClient.delete(`api/review/requests/${requestId}/assignments/${assignmentId}`);
  },

  complete(requestId, body) {
    return apiClient.post(`api/review/requests/${requestId}/complete`, body);
  },

  updateTripLog(tripLogId, body) {
    return apiClient.put(`api/review/trip-logs/${tripLogId}`, body);
  },
};

export default reviewServices;
