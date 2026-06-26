'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { baseUrl, setAuthToken } from '../config';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { EMAIL_REGEX } from '../utills/emailRegex';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Formik validation schema
  const validationSchema = Yup.object({
    email: Yup.string()
      .matches(EMAIL_REGEX, { message: 'Invalid email address', excludeEmptyString: true })
      .required('Email is required'),
    password: Yup.string()
      .min(6, 'Password must be at least 6 characters')
      .required('Password is required'),
  });

  // Formik form handling
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const { data: result } = await axios.post(`${baseUrl.userLogin}`, {
          email: values.email,
          password: values.password,
        });

        if (result.status === 'Success') {
          setAuthToken(result.token);
          toast.success(result.message || 'Login successful');
          router.push('/');
        } else {
          toast.error(result.message || 'Login failed');
        }
      } catch (error: any) {
        console.error(error);
        toast.error(
          error?.response?.data?.message ||
          error?.message ||
          'Something went wrong'
        );
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white px-4 overflow-hidden">
      {/* Premium ambient background */}
      {/* <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-[#3B82F6]/15 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-32 h-[480px] w-[480px] rounded-full bg-[#3B82F6]/10 blur-3xl"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#3B82F60A_1px,transparent_1px),linear-gradient(to_bottom,#3B82F60A_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"></div>
      </div> */}

      <div className="relative w-full max-w-md">
        {/* Glow ring */}
        {/* <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-[#3B82F6] via-[#3B82F6]/40 to-transparent opacity-70 blur-[2px]"></div> */}

        <div className="relative rounded-3xl bg-white p-9 border border-[#3B82F6]">
          {/* Header */}
          <div className="text-center mb-9">
            <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-[#3B82F6] rotate-6 shadow-lg shadow-blue-500/40"></div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#1d4ed8] -rotate-3"></div>
              <Lock className="relative h-7 w-7 text-white drop-shadow" />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-pulse"></span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3B82F6]">Reseller Panel</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Welcome <span className="text-[#3B82F6]">Back</span>
            </h1>
            <p className="mt-2 text-sm text-gray-500">Access your reseller dashboard & manage clients</p>
          </div>

          <form noValidate onSubmit={formik.handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Email Address <span className="text-red-700 ml-1">*</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-[#3B82F6] transition-colors" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-4 text-gray-900 placeholder-gray-400 outline-none transition-all bg-gray-50/60 focus:bg-white ${formik.touched.email && formik.errors.email
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#3B82F6] focus:ring-blue-100'
                    } focus:ring-4`}
                  placeholder="reseller@company.com"
                />
              </div>
              {formik.touched.email && formik.errors.email && (
                <p className="mt-1.5 text-sm text-red-500">{formik.errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Password <span className="text-red-700 ml-1">*</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#3B82F6] transition-colors" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="••••••••••"
                  className={`w-full rounded-xl border py-3.5 pl-11 pr-12 text-gray-900 placeholder-gray-400 outline-none transition-all bg-gray-50/60 focus:bg-white ${formik.touched.password && formik.errors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#3B82F6] focus:ring-blue-100'
                    } focus:ring-4`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-[#3B82F6] hover:bg-blue-50 transition-all focus:outline-none z-10"
                  style={{ background: 'transparent', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {formik.touched.password && formik.errors.password && (
                <p className="mt-1.5 text-sm text-red-500">{formik.errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#1d4ed8] py-4 text-sm font-bold tracking-wider text-white shadow-lg shadow-blue-500/40 transition-all hover:shadow-xl hover:shadow-blue-500/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"></span>
              {loading ? (
                <div className="relative flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                <span className="relative flex items-center gap-2">
                  SIGN IN TO PANEL
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </span>
              )}
            </button>

          </form>
        </div>


      </div>
    </div>

  );
}