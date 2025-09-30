import { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';

const LoginForm = ({ onSuccess, role = 'user' }) => {
  const { login } = useAuth();
  const roleKey = role?.toString().toLowerCase();
  const isStaff = roleKey === 'staff' || roleKey === 'manager' || roleKey === 'admin';
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: isStaff
      ? { employee_id: '', password: '' }
      : { email: '', password: '' },
    validationSchema: Yup.object(
      isStaff
        ? {
            employee_id: Yup.string().required('Employee ID is required'),
            password: Yup.string().required('Password is required')
          }
        : {
            email: Yup.string().email('Invalid email address').required('Email is required'),
            password: Yup.string().required('Password is required')
          }
    ),
    onSubmit: async (values) => {
      setLoading(true);
      try {
        const payload = isStaff
          ? { employee_id: values.employee_id, password: values.password }
          : { email: values.email, password: values.password };
        await login(payload);
        toast.success('Login successful');
        if (onSuccess) onSuccess();
      } catch (error) {
        toast.error(error.message || 'Login failed. Please check your credentials.');
        console.error('Login error:', error);
      } finally {
        setLoading(false);
      }
    }
  });

  return (
    <div className="w-full max-w-md">
      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={isStaff ? 'employee_id' : 'email'} className="block text-sm font-medium text-[var(--app-text)]">
            {isStaff ? 'Employee ID' : 'Email'}
          </label>
          <input
            id={isStaff ? 'employee_id' : 'email'}
            name={isStaff ? 'employee_id' : 'email'}
            type={isStaff ? 'text' : 'email'}
            autoComplete={isStaff ? 'off' : 'email'}
            placeholder={isStaff ? 'Enter your employee ID' : 'Enter your email'}
            className={`mt-1 input ${
              (isStaff ? (formik.touched.employee_id && formik.errors.employee_id) : (formik.touched.email && formik.errors.email))
                ? 'border-red-500'
                : ''
            }`}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={isStaff ? formik.values.employee_id : formik.values.email}
            disabled={loading}
          />
          {isStaff ? (
            formik.touched.employee_id && formik.errors.employee_id ? (
              <p className="mt-1 text-sm text-red-600">{formik.errors.employee_id}</p>
            ) : null
          ) : (
            formik.touched.email && formik.errors.email ? (
              <p className="mt-1 text-sm text-red-600">{formik.errors.email}</p>
            ) : null
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--app-text)]">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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
          <button
            type="submit"
            className="w-full btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;