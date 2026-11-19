import apiClient from "./services.js";

const destinationServices = {
  list() {
    return apiClient.get("api/destinations");
  },

  create(destination) {
    return apiClient.post("api/destinations", destination);
  },

  update(id, destination) {
    return apiClient.put(`api/destinations/${id}`, destination);
  },
};

export default destinationServices;
