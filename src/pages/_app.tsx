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
import { usePathname, useRouter } from "next/navigation";
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
  const token = useSelector((state: RootState) => state.auth.token);
  const router = useRouter();

  useEffect(() => {
    if (!token && !isLoginPage) {
      router.replace("/login");
    } else if (token && isLoginPage) {
      router.replace("/");
    }
  }, [token, isLoginPage, router]);

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
  const pathName = usePathname();
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
                <main className="animate-in fade-in duration-300">
                  {/* Only show header for non-login pages */}
                  {!isLoginPage ? (
                    <Header toggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
                  ) : null}
                  <div className={isLoginPage ? "p-0" : "p-4 md:p-6"}>
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