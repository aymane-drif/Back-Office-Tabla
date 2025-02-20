// src/authProvider.ts
import { AuthProvider } from "@refinedev/core";
import axiosInstance from "./axiosInstance";

// We extend AuthProvider with our custom refresh method.
type ExtendedAuthProvider = AuthProvider & {
    refresh?: () => Promise<any>;
};

let refreshInterval: ReturnType<typeof setInterval> | null = null;

const startRefreshTimer = (authProvider: ExtendedAuthProvider) => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    // Set an interval of 50 minutes (50 * 60 * 1000 ms)
    refreshInterval = setInterval(async () => {
        const isLoggedIn = localStorage.getItem("isLogedIn") === "true";
        const refreshToken = localStorage.getItem("refresh");
        if (isLoggedIn && refreshToken) {
            try {
                await authProvider.refresh?.();
                console.log("Token refreshed successfully");
            } catch (error) {
                console.error("Token refresh failed", error);
            }
        }
    }, 50 * 60 * 1000);
};

const authProvider: ExtendedAuthProvider = {
    onError: async (error) => {
        console.error("AuthProvider error:", error);
        return Promise.reject(error);
    },

    login: async ({ username, password }) => {
        try {
            const response = await axiosInstance.post("/auth/login", { username, password });
            if (response.data.token) {
                localStorage.setItem("isLogedIn", "true");
                localStorage.setItem("refresh", response.data.refresh);

                if (response?.data.user.is_manager) {
                    localStorage.setItem("is_manager", "true");
                  }

                if (response.data.users.permissions) {
                    localStorage.setItem("permissions", JSON.stringify(response.data.users.permissions));
                }

                // Start the refresh timer after a successful login.
                startRefreshTimer(authProvider);
                return Promise.resolve({ success: true });
            } else {
                return Promise.reject({ success: false });
            }
        } catch (error) {
            return Promise.reject(error);
        }
    },

    logout: async () => {
        localStorage.removeItem("isLogedIn");
        localStorage.removeItem("refresh");
        localStorage.removeItem("restaurant_id");
        localStorage.removeItem("permissions");
        localStorage.removeItem("is_manager");

        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        return Promise.resolve({ success: true });
    },

    check: async () => {
        return localStorage.getItem("isLogedIn") === "true"
        ? Promise.resolve({ authenticated: true })
        : Promise.reject({
            authenticated: false,
            error: { message: "Not authenticated", name: "Unauthorized" },
            logout: true,
            redirectTo: "/login",
          });
    },

    getPermissions: async () => {
        const stored = localStorage.getItem("permissions");
        return stored ? Promise.resolve(JSON.parse(stored)) : Promise.resolve([]);
    },

    getIdentity: async () => {
        const token = localStorage.getItem("token");
        if (!token) return Promise.reject();
        try {
            const response = await axiosInstance.get("/api/v1/bo/restaurants/users/me/");
            return Promise.resolve(response.data);
        } catch (error) {
            return Promise.reject();
        }
    },

    // Custom refresh method to update the refresh token.
    refresh: async () => {
        try {
            const refreshToken = localStorage.getItem("refresh");
            if (!refreshToken) {
                return Promise.reject("No refresh token available");
            }
            const response = await axiosInstance.post("/api/v1/auth/token/refresh/", { refresh: refreshToken });
            if (response.data.refresh) {
                localStorage.setItem("refresh", response.data.refresh);
                return Promise.resolve({ success: true });
            } else {
                return Promise.reject({ success: false });
            }
        } catch (error) {
            return Promise.reject(error);
        }
    },
};

export default authProvider;
