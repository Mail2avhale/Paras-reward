const StatusBadge = ({ status, type = 'order' }) => {
  const getStatusStyles = () => {
    if (type === 'order') {
      switch (status) {
        case 'pending':
          return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'processing':
          return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'shipped':
          return 'bg-purple-100 text-purple-800 border-purple-300';
        case 'delivered':
          return 'bg-green-100 text-green-800 border-green-300';
        case 'cancelled':
          return 'bg-red-100 text-red-800 border-red-300';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    } else if (type === 'kyc') {
      switch (status) {
        case 'verified':
          return 'bg-green-100 text-green-800 border-green-300';
        case 'pending':
          return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'rejected':
          return 'bg-red-100 text-red-800 border-red-300';
        case 'not_submitted':
          return 'bg-gray-100 text-gray-800 border-gray-300';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    } else if (type === 'membership') {
      switch (status) {
        case 'vip':
          return 'bg-purple-100 text-purple-800 border-purple-300';
        case 'free':
          return 'bg-gray-100 text-gray-800 border-gray-300';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-300';
      }
    }
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyles()}`}>
      {status ? status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
    </span>
  );
};

export default StatusBadge;