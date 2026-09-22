import "@/styles/globals.css";
import { Provider, useSelector } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor, RootState } from "@/store";
import type { AppProps } from "next/app";
import { Poppins } from "next/font/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import axios from "axios";
import { clearAuthToken } from "@/config";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  adjustFontFallback: false,
});

if (typeof window !== "undefined") {
  axios.interceptors.request.use((config) => {
    const { getAuthToken } = require("@/config");
    const token = getAuthToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        clearAuthToken();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
      return Promise.reject(error);
    }
  );
}

function AuthGuard({ children, isLoginPage }: { children: React.ReactNode; isLoginPage: boolean }) {
  const { token, user } = useSelector((state: RootState) => state.auth);
  const router = useRouter();

  useEffect(() => {
    if (!token && !isLoginPage) {
      router.replace("/login");
    } else if (token && isLoginPage) {
      router.replace("/");
    }
  }, [token, isLoginPage, router]);

  // Sync fresh permissions & role from server on initial mount / token load
  useEffect(() => {
    if (!token || isLoginPage) return;
    const syncProfile = async () => {
      try {
        const { baseUrl } = require("@/config");
        const { setCredentials } = require("@/store/slices/authSlice");
        const res = await axios.get(baseUrl.myProfile, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.data) {
          const u = res.data.data;
          const roleName = u.role?.roleName || (typeof u.role === 'string' ? u.role : 'reseller');
          const perms = u.role?.permissions?.[0] || null;
          store.dispatch(setCredentials({
            token,
            user: {
              _id: u._id,
              fullName: u.fullName,
              email: u.email,
              phone: u.phone,
            },
            role: roleName,
            permissions: perms,
          }));
        }
      } catch (err) {
        // Silently continue if network fails
      }
    };
    syncProfile();
  }, [token, isLoginPage]);

  // Show clean spinner while routing if unauthenticated
  if (!token && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0b2a55] border-t-transparent"></div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  const pathName = router.pathname;
  const isLoginPage = pathName === "/login";

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthGuard isLoginPage={isLoginPage}>
          <div className={poppins.className}>
            <div className="flex min-h-screen bg-white">
              {!isLoginPage && (
                <Sidebar
                  isOpen={isSidebarOpen}
                  toggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                />
              )}
              <div
                className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${
                  !isLoginPage ? (isSidebarOpen ? 'md:ml-64' : 'md:ml-20') : ''
                }`}
              >
                <main className="flex flex-col h-screen">
                  {/* Only show header for non-login pages */}
                  {!isLoginPage ? (
                    <Header toggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
                  ) : null}
                  <div className={isLoginPage ? "p-0 flex-1 overflow-auto" : "p-6 flex-1 overflow-auto"}>
                    <Component {...pageProps} />
                  </div>
                </main>
              </div>
            </div>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </div>
        </AuthGuard>
      </PersistGate>
    </Provider>
  );
}