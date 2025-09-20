import React from 'react';

interface CrisisAlertProps {
  level: 'low' | 'medium' | 'high';
  onClose: () => void;
  onContactCrisisLine: () => void;
  onContactEmergency: () => void;
}

const CrisisAlert: React.FC<CrisisAlertProps> = ({ level, onClose, onContactCrisisLine, onContactEmergency }) => {
  const getAlertContent = () => {
    switch (level) {
      case 'high':
        return {
          title: '🚨 Immediate Support Needed',
          message: "I'm very concerned about what you've shared. Please know that your life matters and you're not alone.",
          urgency: 'Please reach out for immediate help:',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200'
        };
      case 'medium':
        return {
          title: '⚠️ Support Recommended',
          message: "It sounds like you're going through a really difficult time. Your feelings are valid.",
          urgency: 'Consider reaching out for support:',
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-800 dark:text-orange-200'
        };
      case 'low':
        return {
          title: '💙 Support Available',
          message: "I hear that you're struggling. Remember that support is always available.",
          urgency: 'Resources that might help:',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-800 dark:text-blue-200'
        };
    }
  };

  const { title, message, urgency, bgColor, borderColor, textColor } = getAlertContent();

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-scale-in`}>
      <div className={`${bgColor} border-2 ${borderColor} rounded-2xl p-6 max-w-md w-full mx-auto glass-morphism animate-fade-in-up`}>
        <div className="flex justify-between items-start mb-4">
          <h3 className={`text-lg font-bold ${textColor}`}>{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-semibold transition-colors"
          >
            ×
          </button>
        </div>
        
        <p className={`${textColor} mb-4 leading-relaxed`}>{message}</p>
        
        <div className={`${textColor} mb-4`}>
          <p className="font-semibold mb-2">{urgency}</p>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onContactCrisisLine}
            className="gen-z-button w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          >
            📞 Call/Text 988 (Crisis Lifeline)
          </button>
          
          <button
            onClick={() => {
              window.open('sms:741741', '_blank');
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-teal-500 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          >
            💬 Text HOME to 741741
          </button>
          
          {level === 'high' && (
            <button
              onClick={onContactEmergency}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full font-semibold hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 animate-pulse"
            >
              🚨 Call 911 (Emergency)
            </button>
          )}
        </div>
        
        <div className={`mt-4 p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 ${textColor}`}>
          <p className="text-sm font-medium mb-2">Remember:</p>
          <ul className="text-sm space-y-1">
            <li>• You matter and your life has value</li>
            <li>• These feelings are temporary</li>
            <li>• Professional help is available 24/7</li>
            <li>• You don't have to go through this alone</li>
          </ul>
        </div>
        
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            I'm Safe For Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrisisAlert;