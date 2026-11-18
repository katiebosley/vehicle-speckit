import apiClient from "./services.js";

export default {
  getProfile() {
    return apiClient.get("profile");
  },
  updateProfile(data) {
    return apiClient.put("profile", data);
  },
};
