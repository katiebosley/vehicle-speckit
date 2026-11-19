import apiClient from "./services.js";

const vehicleTypeServices = {
  list() {
    return apiClient.get("vehicle-types");
  },

  create(type) {
    return apiClient.post("vehicle-types", type);
  },

  update(id, type) {
    return apiClient.put(`vehicle-types/${id}`, type);
  },
};

export default vehicleTypeServices;
