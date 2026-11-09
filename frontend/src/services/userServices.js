import apiClient from "./services.js";

export default {
  getUsers(search = "") {
    return apiClient.get("users", { params: search ? { search } : {} });
  },
  updateUser(userId, data) {
    return apiClient.put(`users/${userId}`, data);
  },
};
