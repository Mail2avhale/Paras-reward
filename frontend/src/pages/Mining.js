// Mining.js - Now uses the new Futuristic Mining Dashboard
import FuturisticMiningDashboard from '@/components/mining/FuturisticMiningDashboard';

// Export the new futuristic dashboard as the default
const Mining = ({ user }) => {
  return <FuturisticMiningDashboard user={user} />;
};

export default Mining;
