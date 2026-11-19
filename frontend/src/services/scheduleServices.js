import apiClient from "./services.js";

const scheduleServices = {
  calendar(params) {
    return apiClient.get("calendar", { params });
  },

  availability(params) {
    return apiClient.get("availability", { params });
  },

  dashboard() {
    return apiClient.get("dashboard");
  },

  checkout(assignmentId, body) {
    return apiClient.post(`assignments/${assignmentId}/checkout`, body);
  },

  checkin(assignmentId, body) {
    return apiClient.post(`assignments/${assignmentId}/checkin`, body);
  },

  tripLogs(vehicleId) {
    return apiClient.get(`vehicles/${vehicleId}/trip-logs`);
  },
};

export default scheduleServices;
