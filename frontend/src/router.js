import { createRouter, createWebHistory } from "vue-router";
import Home from "./views/Home.vue";
import VehicleTypes from "./views/VehicleTypes.vue";
import Utils from "./config/utils.js";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: Home,
    },
    {
      path: "/vehicle-types",
      name: "vehicle-types",
      component: VehicleTypes,
      meta: { roles: ["admin"] },
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: { name: "home" },
    },
  ],
});

router.beforeEach((to) => {
  const roles = to.meta.roles;
  if (!roles) {
    return true;
  }

  const user = Utils.getStore("user");
  if (!user || !roles.includes(user.role)) {
    return { name: "home" };
  }

  return true;
});

export default router;
