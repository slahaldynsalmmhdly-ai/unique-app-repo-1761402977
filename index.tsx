

import { handleLogin, fetchAndRenderConversations, handleLogout, handleConversationClick, handleBackToMain, handleSendMessage, handleMessageInput, handleAttachment, handleAttachmentClick, handleCloseMediaPreview, handleSendMedia, handleMoreOptions, openCurrentUserProfile, handleProfileBack, handleSendMessageFromProfile, handleShowAllMedia, handleAllMediaBack, renderMyProfile, handleMyProfileBack, handleMessageLongPress, handleMessageOptionClick, loadCallLogs, handleBlockUser, handleUnblockUser, handleReportChat } from './handlers.js';
import type { User, Message } from './types.js';
import { apiFetch } from './api.js';
import { getCachedConversations } from './cache.js';
import { showLoginError, showToast, setActiveTab } from './ui.js';


// --- GLOBAL STATE ---
const state: {
  currentConversationId: string | null;
  currentUser: User | null;
  selectedImageFile: File | null;
  selectedImageDataUrl: string | null;
  selectedVideoFile: File | null;
  selectedVideoDataUrl: string | null;
  backgroundSyncIntervalId: number | null;
  currentProfileSharedMedia: any[];
  selectedMessage: Message | null;
  currentCallLogId: string | null;
  callStartTime: number | null;
  currentCallReceiverId: string | null;
  isBlockedByYou: boolean;
  blockedByOther: boolean;
  currentParticipantId: string | null;
} = {
  currentConversationId: null,
  currentUser: null,
  selectedImageFile: null,
  selectedImageDataUrl: null,
  selectedVideoFile: null,
  selectedVideoDataUrl: null,
  backgroundSyncIntervalId: null,
  currentProfileSharedMedia: [],
  selectedMessage: null,
  currentCallLogId: null,
  callStartTime: null,
  currentCallReceiverId: null,
  isBlockedByYou: false,
  blockedByOther: false,
  currentParticipantId: null,
};


document.addEventListener('DOMContentLoaded', function() {

  // --- ELEMENT SELECTORS ---
  const dom = {
      loginPage: document.getElementById('loginPage') as HTMLElement,
      mainPage: document.getElementById('mainPage') as HTMLElement,
      chatPage: document.getElementById('chatPage') as HTMLElement,
      profilePage: document.getElementById('profilePage') as HTMLElement,
      voiceCallPage: document.getElementById('voiceCallPage') as HTMLElement,
      videoCallPage: document.getElementById('videoCallPage') as HTMLElement,
      fullScreenLoader: document.getElementById('fullScreenLoader') as HTMLElement,
      allMediaPage: document.getElementById('allMediaPage') as HTMLElement,
      myProfilePage: document.getElementById('myProfilePage') as HTMLElement,
      myProfileBackBtn: document.getElementById('myProfileBackBtn') as HTMLElement,
      myProfileLogoutBtn: document.getElementById('myProfileLogoutBtn') as HTMLElement,
      myProfileAvatar: document.getElementById('myProfileAvatar') as HTMLImageElement,
      myProfileName: document.getElementById('myProfileName') as HTMLElement,
      myProfileEmail: document.getElementById('myProfileEmail') as HTMLElement,
      myProfileDescription: document.getElementById('myProfileDescription') as HTMLElement,
      myProfilePhone: document.getElementById('myProfilePhone') as HTMLElement,
      myProfileMessagesCount: document.getElementById('myProfileMessagesCount') as HTMLElement,
      myProfileImagesCount: document.getElementById('myProfileImagesCount') as HTMLElement,
      myProfileLinksCount: document.getElementById('myProfileLinksCount') as HTMLElement,
      myProfileSharedMedia: document.getElementById('myProfileSharedMedia') as HTMLElement,
      loginBtn: document.getElementById('loginBtn') as HTMLButtonElement,
      loginBtnText: document.getElementById('loginBtnText') as HTMLElement,
      loginLoader: document.getElementById('loginLoader') as HTMLElement,
      loginEmail: document.getElementById('loginEmail') as HTMLInputElement,
      loginPassword: document.getElementById('loginPassword') as HTMLInputElement,
      logoutBtn: document.getElementById('logoutBtn') as HTMLButtonElement,
      conversationsContainer: document.querySelector('#mainPage main .space-y-1') as HTMLElement,
      chatUserName: document.getElementById('chatUserName') as HTMLElement,
      chatAvatar: document.getElementById('chatAvatar') as HTMLImageElement,
      backBtn: document.getElementById('backBtn') as HTMLElement,
      messagesContainer: document.getElementById('messagesContainer') as HTMLElement,
      messageInput: document.getElementById('messageInput') as HTMLInputElement,
      sendBtn: document.getElementById('sendBtn') as HTMLElement,
      voiceBtn: document.getElementById('voiceBtn') as HTMLElement,
      imagePreviewPage: document.getElementById('imagePreviewPage') as HTMLElement,
      closePreviewBtn: document.getElementById('closePreviewBtn') as HTMLButtonElement,
      previewImage: document.getElementById('previewImage') as HTMLImageElement,
      imageCaptionInput: document.getElementById('imageCaptionInput') as HTMLInputElement,
      sendImageBtn: document.getElementById('sendImageBtn') as HTMLButtonElement,
      videoPreviewPage: document.getElementById('videoPreviewPage') as HTMLElement,
      closeVideoPreviewBtn: document.getElementById('closeVideoPreviewBtn') as HTMLButtonElement,
      previewVideo: document.getElementById('previewVideo') as HTMLVideoElement,
      videoCaptionInput: document.getElementById('videoCaptionInput') as HTMLInputElement,
      sendVideoBtn: document.getElementById('sendVideoBtn') as HTMLButtonElement,
      allMediaBackBtn: document.getElementById('allMediaBackBtn') as HTMLElement,
      allMediaGrid: document.getElementById('allMediaGrid') as HTMLElement,
      attachBtn: document.getElementById('attachBtn'),
      attachmentModal: document.getElementById('attachmentModal'),
      attachmentSheet: document.getElementById('attachmentSheet'),
      modalOverlay: document.getElementById('modalOverlay'),
      moreOptionsBtn: document.getElementById('moreOptionsBtn'),
      moreOptionsModal: document.getElementById('moreOptionsModal'),
      moreOptionsSheet: document.getElementById('moreOptionsSheet'),
      moreModalOverlay: document.getElementById('moreModalOverlay'),
      profileBackBtn: document.getElementById('profileBackBtn'),
      messageOptionsModal: document.getElementById('messageOptionsModal'),
      messageOptionsSheet: document.getElementById('messageOptionsSheet'),
      messageOptionsOverlay: document.getElementById('messageOptionsOverlay'),
      messageOptionsContainer: document.getElementById('messageOptionsContainer'),
      reportUserModal: document.getElementById('reportUserModal') as HTMLElement,
      reportUserSheet: document.getElementById('reportUserSheet') as HTMLElement,
      reportUserOverlay: document.getElementById('reportUserOverlay') as HTMLElement,
      closeReportUserBtn: document.getElementById('closeReportUserBtn') as HTMLElement,
      sendReportBtn: document.getElementById('sendReportBtn') as HTMLButtonElement,
      reportUserTextarea: document.getElementById('reportUserTextarea') as HTMLTextAreaElement,
      notificationsPage: document.getElementById('notificationsPage') as HTMLElement,
      notificationsBackBtn: document.getElementById('notificationsBackBtn') as HTMLElement,
      bottomNav: document.getElementById('bottomNav') as HTMLElement,
      blockedNotice: document.getElementById('blockedNotice') as HTMLElement,
      blockActions: document.getElementById('blockActions') as HTMLElement,
      unblockBtn: document.getElementById('unblockBtn') as HTMLButtonElement,
      normalInputContainer: document.getElementById('normalInputContainer') as HTMLElement,
      voiceCallBtn: document.getElementById('voiceCallBtn') as HTMLButtonElement,
      videoCallBtn: document.getElementById('videoCallBtn') as HTMLButtonElement,
  };
  
  // --- INITIALIZATION & EVENT LISTENERS ---
  
  function initializeApp() {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');

    if (token && userJson) {
      state.currentUser = JSON.parse(userJson);
      dom.loginPage.classList.add('hidden');
      dom.mainPage.classList.remove('hidden');
      fetchAndRenderConversations(false, dom, state); // Initial load (cache-first)

      // Start background sync
      if (state.backgroundSyncIntervalId) clearInterval(state.backgroundSyncIntervalId);
      state.backgroundSyncIntervalId = window.setInterval(() => fetchAndRenderConversations(true, dom, state), 60000);

    } else {
      dom.loginPage.classList.remove('hidden');
      dom.mainPage.classList.add('hidden');
    }
  }

  // Login Logic
  if (dom.loginBtn) {
    dom.loginBtn.addEventListener('click', () => handleLogin(dom, state));
  }
  if (dom.loginPassword) {
    dom.loginPassword.addEventListener('keypress', (e) => e.key === 'Enter' && handleLogin(dom, state));
  }
  if (dom.logoutBtn) {
    dom.logoutBtn.addEventListener('click', () => handleLogout(dom, state));
  }
  if (dom.myProfileLogoutBtn) {
      dom.myProfileLogoutBtn.addEventListener('click', () => handleLogout(dom, state));
  }

  // Open Chat Logic (Event Delegation)
  if (dom.conversationsContainer) {
    dom.conversationsContainer.addEventListener('click', (e) => handleConversationClick(e, dom, state));
  }

  // Page Navigation
  if (dom.backBtn) {
    dom.backBtn.addEventListener('click', () => handleBackToMain(dom, state));
  }
  if (dom.profileBackBtn) {
    dom.profileBackBtn.addEventListener('click', () => handleProfileBack(dom, state));
  }
  if (dom.allMediaBackBtn) {
    dom.allMediaBackBtn.addEventListener('click', () => handleAllMediaBack(dom));
  }
  if (dom.myProfileBackBtn) {
      dom.myProfileBackBtn.addEventListener('click', () => handleMyProfileBack(dom));
  }
  if (dom.notificationsBackBtn) {
    dom.notificationsBackBtn.addEventListener('click', () => {
        if (dom.notificationsPage) dom.notificationsPage.classList.add('hidden');
        dom.mainPage.classList.remove('hidden');
        if (dom.bottomNav) dom.bottomNav.classList.remove('hidden');
        setActiveTab('individuals');
    });
  }

  // Messaging
  if (dom.messageInput) {
    dom.messageInput.addEventListener('input', () => handleMessageInput(dom));
    dom.messageInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleSendMessage(dom, state));
  }
  if (dom.sendBtn) {
    dom.sendBtn.addEventListener('click', () => handleSendMessage(dom, state));
  }
  
  // Attachments & Media Preview
  if (dom.attachmentModal) {
    dom.attachmentModal.addEventListener('click', (e) => handleAttachmentClick(e, dom, state));
  }
  if (dom.closePreviewBtn) {
    dom.closePreviewBtn.addEventListener('click', () => handleCloseMediaPreview(dom, state));
  }
  if (dom.sendImageBtn) {
    dom.sendImageBtn.addEventListener('click', () => handleSendMedia('image', dom, state));
  }
  if (dom.imageCaptionInput) {
    dom.imageCaptionInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleSendMedia('image', dom, state));
  }
  if (dom.closeVideoPreviewBtn) {
    dom.closeVideoPreviewBtn.addEventListener('click', () => handleCloseMediaPreview(dom, state));
  }
  if (dom.sendVideoBtn) {
    dom.sendVideoBtn.addEventListener('click', () => handleSendMedia('video', dom, state));
  }
  if (dom.videoCaptionInput) {
    dom.videoCaptionInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleSendMedia('video', dom, state));
  }
  
  // Modals
  function closeAttachmentModal() {
    if (!dom.attachmentSheet || !dom.attachmentModal) return;
    dom.attachmentSheet.classList.add('translate-y-full');
    setTimeout(() => {
      dom.attachmentModal.classList.add('hidden');
    }, 300);
  }
  if (dom.attachBtn) {
    dom.attachBtn.addEventListener('click', () => handleAttachment(dom));
  }
  if (dom.modalOverlay) {
    dom.modalOverlay.addEventListener('click', closeAttachmentModal);
  }

  function closeMoreModal() {
    if (!dom.moreOptionsSheet || !dom.moreOptionsModal) return;
    dom.moreOptionsSheet.classList.add('translate-y-full');
    setTimeout(() => {
      dom.moreOptionsModal.classList.add('hidden');
    }, 300);
  }
  if (dom.moreOptionsBtn) {
    dom.moreOptionsBtn.addEventListener('click', () => handleMoreOptions(dom));
  }
  if (dom.moreModalOverlay) {
    dom.moreModalOverlay.addEventListener('click', closeMoreModal);
  }

    // --- NEW: Report User Modal Logic ---
    function openReportModal() {
        if (!dom.reportUserModal || !dom.reportUserSheet) return;
        closeMoreModal(); // Close the more options modal first
        dom.reportUserModal.classList.remove('hidden');
        setTimeout(() => {
            dom.reportUserSheet.classList.remove('translate-y-full');
        }, 50); // Small delay to ensure smooth transition
    }

    function closeReportModal() {
        if (!dom.reportUserSheet || !dom.reportUserModal) return;
        dom.reportUserSheet.classList.add('translate-y-full');
        setTimeout(() => {
            dom.reportUserModal.classList.add('hidden');
            if (dom.reportUserTextarea) dom.reportUserTextarea.value = ''; // Clear textarea
        }, 300);
    }

    async function handleSendReport() {
        if (!dom.sendReportBtn || !dom.reportUserTextarea) return;
        const reportText = dom.reportUserTextarea.value.trim();
        if (!reportText) {
            showToast('يرجى كتابة سبب البلاغ', 'error');
            return;
        }
        
        if (!state.currentParticipantId) {
            showToast('لا يمكن تحديد المستخدم للإبلاغ عنه', 'error');
            return;
        }

        const btnContent = dom.sendReportBtn.querySelector('.btn-content') as HTMLElement;
        const loader = dom.sendReportBtn.querySelector('.loader') as HTMLElement;

        if (!btnContent || !loader) return;

        btnContent.classList.add('hidden');
        loader.classList.remove('hidden');
        dom.sendReportBtn.disabled = true;

        try {
            await apiFetch('/api/v1/reports', {
                method: 'POST',
                body: JSON.stringify({
                    reportType: 'user',
                    targetId: state.currentParticipantId,
                    reason: 'spam', 
                    details: reportText,
                })
            });
            showToast('تم إرسال بلاغك بنجاح');
            closeReportModal();
        } catch (error: any) {
            showToast('فشل إرسال البلاغ: ' + error.message, 'error');
        } finally {
            btnContent.classList.remove('hidden');
            loader.classList.add('hidden');
            dom.sendReportBtn.disabled = false;
        }
    }
    
    // Listen for clicks inside the 'More Options' modal to delegate actions
    if (dom.moreOptionsModal) {
        dom.moreOptionsModal.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button[data-action]');
            if (!button) return;

            const action = (button as HTMLElement).dataset.action;
            if (action === 'report-user') {
                openReportModal();
            } else if (action === 'block') {
                if (state.currentParticipantId) {
                    handleBlockUser(state.currentParticipantId, state, dom);
                }
                closeMoreModal();
            } else if (action === 'report-chat') {
                if (state.currentParticipantId) {
                    handleReportChat(state.currentParticipantId);
                }
                closeMoreModal();
            }
        });
    }

    // Add listeners for the new Report User modal
    if (dom.reportUserOverlay) {
        dom.reportUserOverlay.addEventListener('click', closeReportModal);
    }
    if (dom.closeReportUserBtn) {
        dom.closeReportUserBtn.addEventListener('click', closeReportModal);
    }
    if (dom.sendReportBtn) {
        dom.sendReportBtn.addEventListener('click', handleSendReport);
    }
    
    // Add listener for unblock button
    if (dom.unblockBtn) {
        dom.unblockBtn.addEventListener('click', () => {
            if (state.currentParticipantId) {
                handleUnblockUser(state.currentParticipantId, state, dom);
            }
        });
    }

  // --- NEW: Message Options Modal Logic ---
  function closeMessageOptionsModal() {
      if (!dom.messageOptionsSheet || !dom.messageOptionsModal) return;
      dom.messageOptionsSheet.classList.add('translate-y-full');
      setTimeout(() => {
          dom.messageOptionsModal.classList.add('hidden');
          state.selectedMessage = null; // Clear selected message on close
      }, 300);
  }
  if (dom.messageOptionsOverlay) {
      dom.messageOptionsOverlay.addEventListener('click', closeMessageOptionsModal);
  }
  if (dom.messageOptionsModal) {
      dom.messageOptionsModal.addEventListener('click', (e) => handleMessageOptionClick(e, dom, state));
  }

    // --- NEW: Long Press Logic for Messages ---
    let longPressTimer: number;
    let startX: number;
    let startY: number;

    if (dom.messagesContainer) {
        const cancelLongPress = () => {
            clearTimeout(longPressTimer);
        };

        // Mouse Events
        dom.messagesContainer.addEventListener('mousedown', (e) => {
            const messageEl = (e.target as HTMLElement).closest('.message-bubble');
            if (!messageEl) return;
            startX = e.clientX;
            startY = e.clientY;
            longPressTimer = window.setTimeout(() => {
                handleMessageLongPress(messageEl as HTMLElement, dom, state);
            }, 500);
        });
        dom.messagesContainer.addEventListener('mouseup', cancelLongPress);
        dom.messagesContainer.addEventListener('mouseleave', cancelLongPress);
        dom.messagesContainer.addEventListener('mousemove', (e) => {
            if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) {
                cancelLongPress();
            }
        });

        // Touch Events
        dom.messagesContainer.addEventListener('touchstart', (e) => {
            const messageEl = (e.target as HTMLElement).closest('.message-bubble');
            if (!messageEl) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            longPressTimer = window.setTimeout(() => {
                e.preventDefault();
                handleMessageLongPress(messageEl as HTMLElement, dom, state);
            }, 500);
        }, { passive: false });
        dom.messagesContainer.addEventListener('touchend', cancelLongPress);
        dom.messagesContainer.addEventListener('touchcancel', cancelLongPress);
        dom.messagesContainer.addEventListener('touchmove', (e) => {
            if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) {
                cancelLongPress();
            }
        });
    }


  // Profile
  if (dom.chatUserName) {
      dom.chatUserName.style.cursor = 'pointer';
      dom.chatUserName.addEventListener('click', () => openCurrentUserProfile(dom, state));
  }
  if (dom.chatAvatar) {
      dom.chatAvatar.style.cursor = 'pointer';
      dom.chatAvatar.addEventListener('click', () => openCurrentUserProfile(dom, state));
  }

  // Delegated body click for dynamic elements from profile page
  document.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;

      if (button.id === 'profileSendMessageBtn') {
          handleSendMessageFromProfile(dom);
      }
      if (button.id === 'showAllMediaBtn') {
          handleShowAllMedia(dom, state);
      }
  });


  // --- STATIC UI FUNCTIONALITY ---
  // (This logic is simple and doesn't require complex state management, so it can stay here)
  const togglePassword = document.getElementById('togglePassword');
  const rememberMe = document.getElementById('rememberMe') as HTMLInputElement;
  const checkIcon = document.getElementById('checkIcon');

  if (togglePassword) {
    togglePassword.addEventListener('click', function() {
      const passwordInput = dom.loginPassword;
      const icon = this.querySelector('i');
      if (!passwordInput || !icon) return;
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'ri-eye-line text-gray-400 text-sm';
      } else {
        passwordInput.type = 'password';
        icon.className = 'ri-eye-off-line text-gray-400 text-sm';
      }
    });
  }

  if (rememberMe) {
    rememberMe.addEventListener('change', function() {
      const checkbox = this.parentElement?.querySelector('div > div:first-child') as HTMLElement;
      const icon = checkIcon;
      if (!checkbox || !icon) return;
      if (this.checked) {
        checkbox.classList.add('bg-white', 'bg-opacity-100');
        checkbox.classList.remove('bg-opacity-20');
        icon.classList.remove('opacity-0');
        icon.classList.add('opacity-100');
      } else {
        checkbox.classList.remove('bg-white', 'bg-opacity-100');
        checkbox.classList.add('bg-opacity-20');
        icon.classList.add('opacity-0');
        icon.classList.remove('opacity-100');
      }
    });
  }

  // Make loadCallLogs available for retry button
  (window as any).loadCallLogs = () => loadCallLogs(dom, state);

  const tabBtns = document.querySelectorAll<HTMLElement>('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // FIX: Use `btn.dataset.tab` instead of `this.dataset.tab` because TypeScript infers `this` as a generic `Element` which lacks the `dataset` property.
            const tab = btn.dataset.tab;
            if (!tab) return;
            
            setActiveTab(tab);

            if (tab === 'individuals') {
                dom.mainPage.classList.remove('hidden');
                if (dom.myProfilePage) dom.myProfilePage.classList.add('hidden');
                if (dom.notificationsPage) dom.notificationsPage.classList.add('hidden');
                if (dom.bottomNav) dom.bottomNav.classList.remove('hidden');
            } else if (tab === 'companies') {
                dom.mainPage.classList.add('hidden');
                if (dom.myProfilePage) dom.myProfilePage.classList.add('hidden');
                if (dom.notificationsPage) dom.notificationsPage.classList.remove('hidden');
                if (dom.bottomNav) dom.bottomNav.classList.add('hidden');
                loadCallLogs(dom, state);
            } else if (tab === 'my-profile') {
                dom.mainPage.classList.add('hidden');
                if (dom.myProfilePage) dom.myProfilePage.classList.remove('hidden');
                if (dom.notificationsPage) dom.notificationsPage.classList.add('hidden');
                if (dom.bottomNav) dom.bottomNav.classList.remove('hidden');
                renderMyProfile(dom, state);
            }
        });
    });

  // Call functionality (remains static as per request)
  const voiceCallBtn = document.getElementById('voiceCallBtn');
  const videoCallBtn = document.getElementById('videoCallBtn');
  const voiceCallEnd = document.getElementById('voiceCallEnd');
  const videoCallEnd = document.getElementById('videoCallEnd');
  const voiceCallMute = document.getElementById('voiceCallMute');
  const videoCallMute = document.getElementById('videoCallMute');
  const voiceCallSpeaker = document.getElementById('voiceCallSpeaker');
  const videoCallCamera = document.getElementById('videoCallCamera');
  let isMuted = false;
  let isSpeakerOn = false;
  let isCameraOn = true;
  
  if (voiceCallBtn) {
    voiceCallBtn.addEventListener('click', function() { // Removed async
      if (!dom.chatPage || !dom.voiceCallPage) return;
  
      const userNameEl = document.getElementById('chatUserName');
      const userAvatarEl = document.getElementById('chatAvatar') as HTMLImageElement;
      const voiceCallUserNameEl = document.getElementById('voiceCallUserName');
      const voiceCallAvatarEl = document.getElementById('voiceCallAvatar') as HTMLImageElement;
  
      if (!userNameEl || !userAvatarEl || !voiceCallUserNameEl || !voiceCallAvatarEl) return;
  
      const userName = userNameEl.textContent;
      const userAvatar = userAvatarEl.src;
  
      const conversations = getCachedConversations();
      const currentConvo = conversations?.find(c => c._id === state.currentConversationId);
  
      if (!currentConvo || !currentConvo.participant) {
        showLoginError('لا يمكن بدء المكالمة');
        return;
      }
  
      const receiverId = currentConvo.participant._id;
  
      // --- IMMEDIATE UI UPDATE ---
      voiceCallUserNameEl.textContent = userName;
      voiceCallAvatarEl.src = userAvatar;
      dom.chatPage.classList.add('hidden');
      dom.voiceCallPage.classList.remove('hidden');
  
      // --- UPDATE STATE IMMEDIATELY ---
      state.callStartTime = Date.now();
      state.currentCallReceiverId = receiverId;
      state.currentCallLogId = null; // Reset in case of previous failed calls
  
      // --- HANDLE API CALLS IN THE BACKGROUND ---
      (async () => {
        try {
          console.log('📞 Starting voice call with:', receiverId);
  
          // Create call log in the API
          const callLog = await apiFetch('/api/v1/call-logs', {
            method: 'POST',
            body: JSON.stringify({
              receiverId: receiverId,
              callType: 'audio',
              status: 'connecting'
            })
          });
  
          console.log('✅ Call log created:', callLog._id);
          state.currentCallLogId = callLog._id;
  
          // Simulate answer after 2 seconds and update status
          setTimeout(async () => {
            if (state.currentCallLogId) {
              try {
                await apiFetch(`/api/v1/call-logs/${state.currentCallLogId}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    status: 'answered'
                  })
                });
                console.log('✅ Call status updated to answered');
              } catch (error) {
                console.error('❌ Failed to update call status:', error);
              }
            }
          }, 2000);
  
        } catch (error: any) {
          console.error('❌ Error starting voice call in background:', error);
          showLoginError('فشل بدء المكالمة: ' + error.message);
          
          // Revert UI on failure
          dom.voiceCallPage.classList.add('hidden');
          dom.chatPage.classList.remove('hidden');
          state.callStartTime = null;
          state.currentCallReceiverId = null;
          state.currentCallLogId = null;
        }
      })();
    });
  }
  if (videoCallBtn) {
    videoCallBtn.addEventListener('click', function() {
      if (!dom.chatPage || !dom.videoCallPage) return;
  
      const userNameEl = document.getElementById('chatUserName');
      const userAvatarEl = document.getElementById('chatAvatar') as HTMLImageElement;
      const videoCallUserNameEl = document.getElementById('videoCallUserName');
      const videoCallAvatarEl = document.getElementById('videoCallAvatar') as HTMLImageElement;
      const videoCallBgEl = document.getElementById('videoCallBg') as HTMLImageElement;
  
      if (!userNameEl || !userAvatarEl || !videoCallUserNameEl || !videoCallAvatarEl || !videoCallBgEl) return;
  
      const userName = userNameEl.textContent;
      const userAvatar = userAvatarEl.src;
  
      // الحصول على receiverId من المحادثة الحالية
      const conversations = getCachedConversations();
      const currentConvo = conversations?.find(c => c._id === state.currentConversationId);
  
      if (!currentConvo || !currentConvo.participant) {
        showLoginError('لا يمكن بدء المكالمة');
        return;
      }
  
      const receiverId = currentConvo.participant._id;
  
      // --- IMMEDIATE UI UPDATE ---
      videoCallUserNameEl.textContent = userName;
      videoCallAvatarEl.src = userAvatar;
      videoCallBgEl.src = userAvatar;
      dom.chatPage.classList.add('hidden');
      dom.videoCallPage.classList.remove('hidden');
  
      // --- UPDATE STATE IMMEDIATELY ---
      state.callStartTime = Date.now();
      state.currentCallReceiverId = receiverId;
      state.currentCallLogId = null;
  
      // --- HANDLE API CALLS IN THE BACKGROUND ---
      (async () => {
        try {
          console.log('📹 Starting video call with:', receiverId);
  
          const callLog = await apiFetch('/api/v1/call-logs', {
            method: 'POST',
            body: JSON.stringify({
              receiverId: receiverId,
              callType: 'video',
              status: 'connecting'
            })
          });
  
          console.log('✅ Video call log created:', callLog._id);
          state.currentCallLogId = callLog._id;
  
          setTimeout(async () => {
            if (state.currentCallLogId) {
              try {
                await apiFetch(`/api/v1/call-logs/${state.currentCallLogId}`, {
                  method: 'PUT',
                  body: JSON.stringify({
                    status: 'answered'
                  })
                });
                console.log('✅ Video call status updated to answered');
              } catch (error) {
                console.error('❌ Failed to update video call status:', error);
              }
            }
          }, 2000);
  
        } catch (error: any) {
          console.error('❌ Error starting video call in background:', error);
          showLoginError('فشل بدء المكالمة المرئية: ' + error.message);
          
          dom.videoCallPage.classList.add('hidden');
          dom.chatPage.classList.remove('hidden');
          state.callStartTime = null;
          state.currentCallReceiverId = null;
          state.currentCallLogId = null;
        }
      })();
    });
  }
  if (voiceCallEnd) {
    voiceCallEnd.addEventListener('click', function() { // Removed async
      if (!dom.voiceCallPage || !dom.chatPage) return;
  
      // --- IMMEDIATE UI UPDATE AND STATE RESET ---
      dom.voiceCallPage.classList.add('hidden');
      dom.chatPage.classList.remove('hidden');
  
      const duration = state.callStartTime
        ? Math.floor((Date.now() - state.callStartTime) / 1000)
        : 0;
      const callLogIdToEnd = state.currentCallLogId; // Copy before clearing state
  
      state.currentCallLogId = null;
      state.callStartTime = null;
      state.currentCallReceiverId = null;
  
      // --- HANDLE API CALL IN THE BACKGROUND ---
      if (callLogIdToEnd) {
        console.log('📞 Ending voice call, duration:', duration, 'seconds');
        apiFetch(`/api/v1/call-logs/${callLogIdToEnd}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'completed',
            duration: duration,
            endedAt: new Date().toISOString()
          })
        }).then(() => {
            console.log('✅ Call log updated successfully in background');
        }).catch((error: any) => {
            console.error('❌ Error updating call log in background:', error);
            // No user-facing error needed here as the UI has already moved on.
        });
      }
    });
  }
  if (videoCallEnd) {
    videoCallEnd.addEventListener('click', function() {
      if (!dom.videoCallPage || !dom.chatPage) return;
  
      dom.videoCallPage.classList.add('hidden');
      dom.chatPage.classList.remove('hidden');
  
      const duration = state.callStartTime
        ? Math.floor((Date.now() - state.callStartTime) / 1000)
        : 0;
      const callLogIdToEnd = state.currentCallLogId;
  
      state.currentCallLogId = null;
      state.callStartTime = null;
      state.currentCallReceiverId = null;
  
      if (callLogIdToEnd) {
        console.log('📹 Ending video call, duration:', duration, 'seconds');
        apiFetch(`/api/v1/call-logs/${callLogIdToEnd}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'completed',
            duration: duration,
            endedAt: new Date().toISOString()
          })
        }).then(() => {
            console.log('✅ Video call log updated successfully in background');
        }).catch((error: any) => {
            console.error('❌ Error updating video call log in background:', error);
        });
      }
    });
  }
  if (voiceCallMute) {
    voiceCallMute.addEventListener('click', function() {
      isMuted = !isMuted;
      const icon = this.querySelector('i');
      if (!icon) return;
      if (isMuted) {
        icon.className = 'ri-mic-off-line text-2xl';
        this.classList.add('bg-red-500', 'bg-opacity-80');
        this.classList.remove('bg-white', 'bg-opacity-20');
      } else {
        icon.className = 'ri-mic-line text-2xl';
        this.classList.remove('bg-red-500', 'bg-opacity-80');
        this.classList.add('bg-white', 'bg-opacity-20');
      }
    });
  }
  if (videoCallMute) {
    videoCallMute.addEventListener('click', function() {
      isMuted = !isMuted;
      const icon = this.querySelector('i');
      if (!icon) return;
      if (isMuted) {
        icon.className = 'ri-mic-off-line text-xl';
        this.classList.add('bg-red-500', 'bg-opacity-80');
        this.classList.remove('bg-white', 'bg-opacity-20');
      } else {
        icon.className = 'ri-mic-line text-xl';
        this.classList.remove('bg-red-500', 'bg-opacity-80');
        this.classList.add('bg-white', 'bg-opacity-20');
      }
    });
  }
  if (voiceCallSpeaker) {
    voiceCallSpeaker.addEventListener('click', function() {
      isSpeakerOn = !isSpeakerOn;
      const icon = this.querySelector('i');
      if (!icon) return;
      if (isSpeakerOn) {
        icon.className = 'ri-volume-down-line text-2xl';
        this.classList.add('bg-primary', 'bg-opacity-80');
        this.classList.remove('bg-white', 'bg-opacity-20');
      } else {
        icon.className = 'ri-volume-up-line text-2xl';
        this.classList.remove('bg-primary', 'bg-opacity-80');
        this.classList.add('bg-white', 'bg-opacity-20');
      }
    });
  }
  if (videoCallCamera) {
    videoCallCamera.addEventListener('click', function() {
      isCameraOn = !isCameraOn;
      const icon = this.querySelector('i');
      if (!icon) return;
      if (!isCameraOn) {
        icon.className = 'ri-vidicon-off-line text-xl';
        this.classList.add('bg-red-500', 'bg-opacity-80');
        this.classList.remove('bg-white', 'bg-opacity-20');
      } else {
        icon.className = 'ri-vidicon-line text-xl';
        this.classList.remove('bg-red-500', 'bg-opacity-80');
        this.classList.add('bg-white', 'bg-opacity-20');
      }
    });
  }

  // START APP
  initializeApp();
});