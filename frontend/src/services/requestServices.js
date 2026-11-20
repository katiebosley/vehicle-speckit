import apiClient from "./services.js";

const requestServices = {
  list() {
    return apiClient.get("requests");
  },

  get(id) {
    return apiClient.get(`requests/${id}`);
  },

  create(body) {
    return apiClient.post("requests", body);
  },

  update(id, body) {
    return apiClient.put(`requests/${id}`, body);
  },

  cancel(id) {
    return apiClient.post(`requests/${id}/cancel`);
  },
};

export default requestServices;
