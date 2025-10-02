import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OrderHistoryList from '../components/orders/OrderHistoryList';
import useCustomerOrder from '../hooks/useCustomerOrder';
import useOrderHistory from '../hooks/useOrderHistory';
import useAuth from '../hooks/useAuth';
import { formatPrice } from '../utils/formatters';
import { formatOrderDate, getOrderTotals } from '../utils/orderHelpers';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { profile, updateProfile: updateProfileFn } = useAuth();
  const { orderId, totalOrderQuantity } = useCustomerOrder();
  const {
    orders: pastOrders,
    loading: pastOrdersLoading,
    error: pastOrdersError,
    refresh: refreshHistory,
  } = useOrderHistory();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    profilePic: '',
    allowMarketing: false,
  });

  useEffect(() => {
    setFormValues({
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      phoneNumber: profile?.phone_number || '',
      profilePic: profile?.profile_pic || '',
      allowMarketing: Boolean(profile?.allow_marketing),
    });
  }, [profile]);

  const filteredPastOrders = useMemo(() => {
    if (!Array.isArray(pastOrders)) return [];
    if (!orderId) return pastOrders;
    return pastOrders.filter((entry) => entry?.order_id !== orderId);
  }, [pastOrders, orderId]);

  const orderCount = useMemo(() => filteredPastOrders.length, [filteredPastOrders]);

  const totalSpent = useMemo(() => {
    if (!filteredPastOrders.length) return 0;
    return filteredPastOrders.reduce((acc, order) => acc + getOrderTotals(order).total, 0);
  }, [filteredPastOrders]);

  const lastOrderDate = useMemo(() => {
    if (!filteredPastOrders.length) return 'No orders yet';
    const first = filteredPastOrders[0];
    return formatOrderDate(first?.order_timestamp);
  }, [filteredPastOrders]);

  const favoriteItem = useMemo(() => {
    if (!filteredPastOrders.length) return null;
    const counts = new Map();
    filteredPastOrders.forEach((order) => {
      (order.items || []).forEach((entry) => {
        if (!entry?.name) return;
        const qty = Number(entry.qty ?? entry.quantity) || 0;
        if (!qty) return;
        counts.set(entry.name, (counts.get(entry.name) || 0) + qty);
      });
    });
    let bestName = null;
    let bestQty = 0;
    counts.forEach((qty, name) => {
      if (qty > bestQty) {
        bestQty = qty;
        bestName = name;
      }
    });
    return bestName ? `${bestName} (${bestQty})` : null;
  }, [filteredPastOrders]);

  const handleBrowseMenu = useCallback(() => {
    navigate('/menu');
  }, [navigate]);

  const avatarInitials = useMemo(() => {
    const first = (profile?.first_name || '').charAt(0);
    const last = (profile?.last_name || '').charAt(0);
    const emailInitial = (profile?.email || '').charAt(0) || 'U';
    return `${(first + last || emailInitial).toUpperCase()}`;
  }, [profile?.email, profile?.first_name, profile?.last_name]);

  const marketingConsentLabel = useMemo(
    () => (profile?.allow_marketing ? 'Opted in' : 'Opted out'),
    [profile?.allow_marketing],
  );

  const handleInputChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setFormValues({
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      phoneNumber: profile?.phone_number || '',
      profilePic: profile?.profile_pic || '',
      allowMarketing: Boolean(profile?.allow_marketing),
    });
  }, [profile]);

  const handleSaveProfile = useCallback(
    async (event) => {
      event.preventDefault();
      if (!updateProfileFn) return;
      setIsSaving(true);
      const payload = {
        first_name: formValues.firstName.trim(),
        last_name: formValues.lastName.trim(),
        phone_number: formValues.phoneNumber.trim() || null,
        profile_pic: formValues.profilePic.trim() || null,
        allow_marketing: formValues.allowMarketing,
      };

      try {
        await updateProfileFn(payload);
        toast.success('Profile updated');
        setIsEditing(false);
      } catch (err) {
        toast.error(err?.message || 'Unable to update profile right now.');
      } finally {
        setIsSaving(false);
      }
    },
    [formValues, updateProfileFn],
  );

  const currentProfileImage = (isEditing ? formValues.profilePic : profile?.profile_pic) || '';

  return (
    <div className="min-h-full bg-[var(--app-bg)] py-10">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--app-primary)] to-[var(--app-accent)] p-6 text-[var(--app-primary-contrast)] shadow-md">
          <p className="text-sm opacity-80">Member profile</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {profile?.first_name || profile?.last_name
              ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
              : 'Guest'}
          </h1>
          {profile?.email ? <p className="mt-1 text-sm opacity-80">{profile.email}</p> : null}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs opacity-70">Orders placed</p>
              <p className="text-xl font-semibold">{orderCount}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Total spent</p>
              <p className="text-xl font-semibold">{formatPrice(totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Items in active order</p>
              <p className="text-xl font-semibold">{totalOrderQuantity}</p>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="space-y-4 rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[rgba(15,23,42,0.1)] text-base font-semibold text-[var(--app-text)]">
                  {currentProfileImage ? (
                    <img
                      src={currentProfileImage}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{avatarInitials}</span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--app-text)]">Profile</h2>
                  <p className="text-xs text-[var(--app-muted)]">{marketingConsentLabel}</p>
                </div>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-xs font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
                >
                  Edit profile
                </button>
              ) : null}
            </div>

            {!isEditing ? (
              <dl className="space-y-3 text-sm text-[var(--app-muted)]">
                <div className="flex justify-between">
                  <dt>Email</dt>
                  <dd className="text-[var(--app-text)]">{profile?.email || 'Not provided'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Phone</dt>
                  <dd className="text-[var(--app-text)]">{profile?.phone_number || 'Not provided'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Member since</dt>
                  <dd className="text-[var(--app-text)]">{profile?.signup_date ? formatOrderDate(profile.signup_date) : 'Unknown'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Favourite dish</dt>
                  <dd className="text-[var(--app-text)]">{favoriteItem || 'Pick a favourite!'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Marketing consent</dt>
                  <dd className="text-[var(--app-text)]">{marketingConsentLabel}</dd>
                </div>
              </dl>
            ) : (
              <form className="space-y-4 text-sm text-[var(--app-muted)]" onSubmit={handleSaveProfile}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide">First name</span>
                    <input
                      type="text"
                      name="firstName"
                      value={formValues.firstName}
                      onChange={handleInputChange}
                      className="w-full rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-[var(--app-text)] focus:border-[var(--app-primary)] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide">Last name</span>
                    <input
                      type="text"
                      name="lastName"
                      value={formValues.lastName}
                      onChange={handleInputChange}
                      className="w-full rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-[var(--app-text)] focus:border-[var(--app-primary)] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide">Phone number</span>
                    <input
                      type="tel"
                      name="phoneNumber"
                      value={formValues.phoneNumber}
                      onChange={handleInputChange}
                      placeholder="e.g. +1 555 123 4567"
                      className="w-full rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-[var(--app-text)] focus:border-[var(--app-primary)] focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs uppercase tracking-wide">Profile picture URL</span>
                    <input
                      type="url"
                      name="profilePic"
                      value={formValues.profilePic}
                      onChange={handleInputChange}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full rounded-full border border-[rgba(15,23,42,0.12)] px-4 py-2 text-[var(--app-text)] focus:border-[var(--app-primary)] focus:outline-none"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-3 text-[var(--app-text)]">
                  <input
                    type="checkbox"
                    name="allowMarketing"
                    checked={formValues.allowMarketing}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-[rgba(15,23,42,0.25)] text-[var(--app-primary)] focus:ring-[var(--app-primary)]"
                  />
                  <span>Consent to receive marketing updates</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-5 py-2 text-xs font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] px-5 py-2 text-xs font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!isEditing && (
              <button
                type="button"
                onClick={handleBrowseMenu}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-4 py-2 text-xs font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90"
              >
                Browse the menu
              </button>
            )}
          </section>

          <section className="space-y-4 rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--app-text)]">Recent activity</h2>
              <button
                type="button"
                onClick={refreshHistory}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
              >
                Refresh
              </button>
            </div>
            <OrderHistoryList
              orders={filteredPastOrders}
              loading={pastOrdersLoading}
              error={pastOrdersError}
              onRefresh={refreshHistory}
              variant="compact"
              emptyMessage="Past orders will appear here once you submit one."
            />
          </section>
        </div>

        <section className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)] shadow-sm">
          <p>Last order: {lastOrderDate}</p>
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
