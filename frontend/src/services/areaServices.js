import apiClient from "./services.js";

const areaServices = {
  list() {
    return apiClient.get("areas");
  },

  mine() {
    return apiClient.get("areas/mine");
  },
};

export default areaServices;
