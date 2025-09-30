import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';

const RegisterForm = ({ onSuccess }) => {
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: ''
      , avatar_preview: '', avatar_file: null
    },
    validationSchema: Yup.object({
      first_name: Yup.string()
        .max(50, 'First name must be 50 characters or less')
        .required('First name is required'),
      last_name: Yup.string()
        .max(50, 'Last name must be 50 characters or less')
        .required('Last name is required'),
      email: Yup.string()
        .email('Invalid email address')
        .required('Email is required'),
      password: Yup.string()
        .min(6, 'Password must be at least 6 characters')
        .required('Password is required'),
      confirmPassword: Yup.string()
        .oneOf([Yup.ref('password'), null], 'Passwords must match')
        .required('Confirm password is required')
    }),
    onSubmit: async (values) => {
      setLoading(true);
      try {
        // Remove confirmPassword field before sending to API
        const { confirmPassword, avatar_preview, avatar_file, ...userData } = values;
        // If an avatar file was selected, upload it first and include returned URL
        if (avatar_file) {
          try {
            const uploaded = await uploadAvatar(avatar_file);
            if (uploaded?.url) {
              userData.avatar = uploaded.url;
            }
          } catch (uploadErr) {
            console.error('Avatar upload failed', uploadErr);
            toast.error('Failed to upload avatar. Try again or continue without one.');
          }
        } else if (avatar_preview) {
          // fallback: include base64 preview if file wasn't stored
          userData.avatar = avatar_preview;
        }

        await register(userData);
        toast.success('Registration successful');
        if (onSuccess) onSuccess();
      } catch (error) {
        toast.error(error.message || 'Registration failed. Please try again.');
        console.error('Registration error:', error);
      } finally {
        setLoading(false);
      }
    }
  });

  // Helper to upload avatar file to backend
  const uploadAvatar = async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/uploads/avatar', {
      method: 'POST',
      body: form
    });
    if (!res.ok) throw new Error('Upload failed');
    return await res.json(); // expect { url: 'https://...' }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        {/* Avatar upload */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-[var(--app-bg)] flex items-center justify-center mb-2 overflow-hidden">
            {formik.values.avatar_preview ? (
              <img src={formik.values.avatar_preview} alt="avatar preview" className="w-full h-full object-cover" />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--app-muted)]">
                <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5 0-9 2.5-9 5v1h18v-1c0-2.5-4-5-9-5z" fill="currentColor"/>
              </svg>
            )}
          </div>
          <label className="text-sm text-[var(--app-muted)] mb-3">Upload profile picture (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                formik.setFieldValue('avatar_file', file);
                const reader = new FileReader();
                reader.onload = () => {
                  // attach preview to form state
                  formik.setFieldValue('avatar_preview', reader.result);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-[var(--app-text)]">First Name</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              placeholder="Enter your first name"
              className={`mt-1 input ${formik.touched.first_name && formik.errors.first_name ? 'border-red-500' : ''}`}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.first_name}
              disabled={loading}
            />
            {formik.touched.first_name && formik.errors.first_name ? (
              <p className="mt-1 text-sm text-red-600">{formik.errors.first_name}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-[var(--app-text)]">Last Name</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              placeholder="Enter your last name"
              className={`mt-1 input ${formik.touched.last_name && formik.errors.last_name ? 'border-red-500' : ''}`}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.last_name}
              disabled={loading}
            />
            {formik.touched.last_name && formik.errors.last_name ? (
              <p className="mt-1 text-sm text-red-600">{formik.errors.last_name}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--app-text)]">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            className={`mt-1 input ${formik.touched.email && formik.errors.email ? 'border-red-500' : ''}`}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.email}
            disabled={loading}
          />
          {formik.touched.email && formik.errors.email ? (
            <p className="mt-1 text-sm text-red-600">{formik.errors.email}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--app-text)]">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password"
            className={`mt-1 input ${formik.touched.password && formik.errors.password ? 'border-red-500' : ''}`}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.password}
            disabled={loading}
          />
          {formik.touched.password && formik.errors.password ? (
            <p className="mt-1 text-sm text-red-600">{formik.errors.password}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--app-text)]">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm your password"
            className={`mt-1 input ${formik.touched.confirmPassword && formik.errors.confirmPassword ? 'border-red-500' : ''}`}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.confirmPassword}
            disabled={loading}
          />
          {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
            <p className="mt-1 text-sm text-red-600">{formik.errors.confirmPassword}</p>
          ) : null}
        </div>

        <div>
          <button
            type="submit"
            className="w-full btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegisterForm;