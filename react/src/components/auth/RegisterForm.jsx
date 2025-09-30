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
        const { confirmPassword, ...userData } = values;
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

  return (
    <div className="w-full max-w-md">
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              First Name
            </label>
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
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Last Name
            </label>
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
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
          </label>
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
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirm Password
          </label>
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