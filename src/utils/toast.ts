/**
 * Show a toast notification
 */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 ${
    type === 'success' ? 'bg-green-500' :
    type === 'error' ? 'bg-red-500' :
    'bg-blue-500'
  } text-white font-medium`;
  toast.textContent = message;
  toast.style.opacity = '0';
  
  document.body.appendChild(toast);
  
  // Fade in
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Fade out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

/**
 * Show error message
 */
export function showError(message: string): void {
  showToast(message, 'error');
}

/**
 * Show success message
 */
export function showSuccess(message: string): void {
  showToast(message, 'success');
}

