import apiClient from "./services.js";

export default {
  loginUser(credential) {
    return apiClient.post("login", { credential });
  },
  logoutUser() {
    return apiClient.post("logout");
  },
};
