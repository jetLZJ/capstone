import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import useAuth from '../hooks/useAuth';

const RegisterPage = () => {
  const [error, setError] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Validation schema using Yup
  const registerSchema = Yup.object().shape({
    username: Yup.string()
      .min(3, 'Username must be at least 3 characters')
      .max(20, 'Username must be less than 20 characters')
      .required('Username is required'),
    email: Yup.string()
      .email('Invalid email address')
      .required('Email is required'),
    password: Yup.string()
      .min(8, 'Password must be at least 8 characters')
      .matches(/[a-zA-Z]/, 'Password must contain at least one letter')
      .matches(/[0-9]/, 'Password must contain at least one number')
      .required('Password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password'), null], 'Passwords must match')
      .required('Confirm password is required'),
    first_name: Yup.string()
      .required('First name is required'),
    last_name: Yup.string()
      .required('Last name is required'),
  });

  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setError(null);
      await register(values);
      navigate('/login', { state: { message: 'Registration successful! Please login.' } });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-[var(--app-surface)] dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-8">
          <h2 className="text-center text-3xl font-extrabold text-[var(--app-text)]">
            Create an Account
          </h2>
          
          {error && (
            <div className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
              <p>{error}</p>
            </div>
          )}
          
          <Formik
            initialValues={{
              username: '',
              email: '',
              password: '',
              confirmPassword: '',
              first_name: '',
              last_name: '',
            }}
            validationSchema={registerSchema}
            onSubmit={handleSubmit}
          >
            {({ isSubmitting }) => (
              <Form className="mt-8 space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-[var(--app-text)]">
                    Username
                  </label>
                  <Field
                    id="username"
                    name="username"
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)] dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                  <ErrorMessage name="username" component="div" className="mt-1 text-sm text-red-600" />
                </div>
                
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-[var(--app-text)]">
                      First Name
                    </label>
                    <Field
                      id="first_name"
                      name="first_name"
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)] dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <ErrorMessage name="first_name" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                  
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-[var(--app-text)]">
                      Last Name
                    </label>
                    <Field
                      id="last_name"
                      name="last_name"
                      type="text"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)] dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <ErrorMessage name="last_name" component="div" className="mt-1 text-sm text-red-600" />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[var(--app-text)]">
                    Email Address
                  </label>
                  <Field
                    id="email"
                    name="email"
                    type="email"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--app-primary)] focus:ring-[var(--app-primary)] dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                  <ErrorMessage name="email" component="div" className="mt-1 text-sm text-red-600" />
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[var(--app-text)]">
                    Password
                  </label>
                  <Field
                    id="password"
                    name="password"
                    type="password"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                  <ErrorMessage name="password" component="div" className="mt-1 text-sm text-red-600" />
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--app-text)]">
                    Confirm Password
                  </label>
                  <Field
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                  <ErrorMessage name="confirmPassword" component="div" className="mt-1 text-sm text-red-600" />
                </div>
                
                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-[var(--app-primary-contrast)] bg-[var(--app-primary)] hover:bg-[var(--app-accent)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--app-primary)] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--app-muted)]">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-[var(--app-primary)] hover:text-[var(--app-accent)]">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;