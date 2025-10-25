import { apiFetch, uploadWithProgress, API_BASE_URL } from './api.js';
import { getCachedConversations, setCachedConversations, addMessageToCache, updateMessageInCache, getCachedMessages, setCachedMessages, getCachedProfile, setCachedProfile, getBlockStatus, setBlockStatus } from './cache.js';
import { showLoginError, renderConversations, showLoader, renderMessages, appendMessage, updateMessageProgress, renderProfileData, getAvatarUrl, renderMessageOptions, setActiveTab, showToast } from './ui.js';
import type { Message, Conversation } from './types.js';


// --- NEW: Helper function to preload media files into the browser cache ---
function preloadMedia(urls: string[]): Promise<void[]> {
    const uniqueUrls = [...new Set(urls)]; // Avoid preloading the same image multiple times
    console.log(`Preloading ${uniqueUrls.length} media items...`);
    const promises = uniqueUrls.map(url => {
        return new Promise<void>((resolve) => {
            if (!url || !url.startsWith('http')) {
                resolve(); // Skip invalid or local (data:...) URLs
                return;
            }

            try {
                // Use URL object to safely parse the pathname and avoid issues with query parameters
                const pathname = new URL(url).pathname;
                const isVideo = /\.(mp4|webm|mov|mkv|avi)$/i.test(pathname);
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname);

                if (isVideo) {
                    const video = document.createElement('video');
                    video.preload = 'metadata'; // Best for performance, fetches dimensions/duration
                    video.src = url;
                    video.onloadedmetadata = () => resolve();
                    video.onerror = () => resolve(); // Don't block sync for one broken video
                } else if (isImage) {
                    const img = new Image();
                    img.src = url;
                    img.onload = () => resolve();
                    img.onerror = () => resolve(); // Don't block sync for one broken image
                } else {
                    // If type is unknown, just resolve and skip
                    console.log('Skipping preload for unknown media type:', url);
                    resolve();
                }
            } catch (e) {
                console.error('Invalid URL for preloading:', url, e);
                resolve(); // Resolve to not block the sync process
            }
        });
    });
    return Promise.all(promises);
}


// --- NEW: Performs the full data sync on the user's first login ---
async function performInitialSync(dom: any) {
    const { conversationsContainer } = dom;
    const loaderText = document.getElementById('loaderText') as HTMLParagraphElement;

    // 1. Fetch Conversations
    if (loaderText) loaderText.textContent = 'جاري مزامنة المحادثات...';
    const conversations: Conversation[] = await apiFetch('/api/v1/chat/conversations');
    setCachedConversations(conversations);
    
    // 2. Fetch All Messages for all conversations
    if (loaderText) loaderText.textContent = 'جاري تحميل الرسائل... (0%)';
    const allMessages: Message[][] = [];
    
    const messageFetchPromises = conversations.map((convo, index) => 
        apiFetch(`/api/v1/chat/conversations/${convo._id}/messages`)
            .then(response => {
                const messages = response.messages || [];
                setCachedMessages(convo._id, messages);
                allMessages.push(messages);
                if (loaderText) {
                    const progress = Math.round(((index + 1) / conversations.length) * 100);
                    loaderText.textContent = `جاري تحميل الرسائل... (${progress}%)`;
                }
            })
    );
    await Promise.all(messageFetchPromises);

    // 3. Gather Media URLs and Fetch All Profiles
    if (loaderText) loaderText.textContent = 'جاري مزامنة الملفات الشخصية...';
    const allMediaUrls: string[] = [];
    allMessages.flat().forEach(msg => {
        if (msg.mediaUrl) {
            let fullUrl = msg.mediaUrl;
            if (!fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
                fullUrl = fullUrl.startsWith('/') ? `${API_BASE_URL}${fullUrl}` : `${API_BASE_URL}/${fullUrl}`;
            }
            allMediaUrls.push(fullUrl);
        }
    });

    const profileFetchPromises = conversations.map(convo => 
        apiFetch(`/api/v1/chat/profile/${convo.participant._id}?conversationId=${convo._id}`)
            .then(profile => {
                setCachedProfile(convo.participant._id, convo._id, profile);
            })
            .catch(err => console.error(`Failed to fetch profile for ${convo.participant._id}`, err)) // Don't fail the whole sync
    );
    await Promise.all(profileFetchPromises);

    // 4. Preload All Media
    if (loaderText) loaderText.textContent = 'جاري تحضير الوسائط...';
    await preloadMedia(allMediaUrls);

    // Render conversations at the end
    renderConversations(conversations, conversationsContainer);
}


export async function handleLogin(dom: any, state: any) {
    const { loginEmail, loginPassword, loginBtn, loginBtnText, loginLoader, fullScreenLoader, loginPage, mainPage } = dom;
    if (!loginEmail || !loginPassword || !loginBtnText || !loginLoader || !loginPage || !mainPage || !fullScreenLoader) return;
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();
    const loaderText = document.getElementById('loaderText') as HTMLParagraphElement;

    if (!email || !password) {
        showLoginError('يرجى ملء جميع الحقول');
        return;
    }

    loginBtnText.classList.add('hidden');
    loginLoader.classList.remove('hidden');
    loginBtn.disabled = true;
    
    try {
        const isInitialSyncComplete = localStorage.getItem('initialSyncComplete') === 'true';

        // Only show the full screen loader if it's the first time
        if (!isInitialSyncComplete) {
            if (loaderText) loaderText.textContent = 'جاري تسجيل الدخول...';
            fullScreenLoader.classList.remove('hidden');
        }

        const data = await apiFetch('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
      
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        state.currentUser = data.user;


        if (!isInitialSyncComplete) {
            await performInitialSync(dom);
            localStorage.setItem('initialSyncComplete', 'true');
        } else {
            // For returning users, load from cache instantly, then fetch updates
            await fetchAndRenderConversations(false, dom, state); 
        }

        loginPage.classList.add('hidden');
        mainPage.classList.remove('hidden');
      
        if (state.backgroundSyncIntervalId) clearInterval(state.backgroundSyncIntervalId);
        state.backgroundSyncIntervalId = window.setInterval(() => fetchAndRenderConversations(true, dom, state), 60000);

    } catch (error: any) {
        showLoginError(error.message || 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
    } finally {
        if (!fullScreenLoader.classList.contains('hidden')) {
            fullScreenLoader.classList.add('hidden');
        }
        loginBtnText.classList.remove('hidden');
        loginLoader.classList.add('hidden');
        loginBtn.disabled = false;
    }
}

export async function fetchAndRenderConversations(isBackground: boolean = false, dom: any, state: any) {
    const { conversationsContainer } = dom;
    if (!conversationsContainer) return;

    // Cache-first strategy
    const cachedConversations = getCachedConversations();
    if (cachedConversations && !isBackground) {
      renderConversations(cachedConversations, conversationsContainer);
    } else if (!cachedConversations && !isBackground) {
      showLoader(conversationsContainer, 'جاري تحميل المحادثات...');
    }

    try {
      const conversations = await apiFetch('/api/v1/chat/conversations');
      renderConversations(conversations, conversationsContainer);
      setCachedConversations(conversations);
    } catch (error: any) {
      console.error('❌ Error fetching conversations:', error);
      if (!cachedConversations) {
        conversationsContainer.innerHTML = `<p class="text-center text-red-500 pt-10">حدث خطأ: ${error.message}</p>`;
      }
    }
}
  
export async function fetchAndRenderMessages(conversationId: string, dom: any) {
    const { messagesContainer } = dom;
    if (!messagesContainer) return;

    // 1. Render instantly from cache. renderMessages handles clearing.
    const cachedMessages = getCachedMessages(conversationId) || [];
    renderMessages(cachedMessages, messagesContainer);
    
    // Scroll to bottom after initial render from cache
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 2. Fetch updates in the background.
    try {
        const response = await apiFetch(`/api/v1/chat/conversations/${conversationId}/messages`);
        const freshMessages = response.messages || [];

        // 3. Diff and append new messages without a full re-render.
        const existingMessageIds = new Set(Array.from(messagesContainer.querySelectorAll('.message-bubble')).map(el => (el as HTMLElement).dataset.id));

        let newMessagesAppended = false;
        freshMessages.forEach((msg: Message) => {
            if (!existingMessageIds.has(msg._id)) {
                appendMessage(msg, messagesContainer);
                newMessagesAppended = true;
            }
        });

        // 4. Update the cache with the full fresh list.
        setCachedMessages(conversationId, freshMessages);
        
        // 5. Scroll only if new messages were added.
        if (newMessagesAppended) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

    } catch (error: any) {
        console.error('❌ Error fetching message updates:', error);
        if (cachedMessages.length === 0) {
            messagesContainer.innerHTML = `<p class="text-center text-red-500 pt-10">حدث خطأ: ${error.message}</p>`;
        } else {
            showToast('فشل تحديث الرسائل', 'error');
        }
    }
}

export async function handleSendMessage(dom: any, state: any) {
    const { messageInput, sendBtn, voiceBtn, messagesContainer } = dom;
    if (!messageInput || !state.currentConversationId) return;
    const content = messageInput.value.trim();

    if (content) {
        messageInput.value = '';
        sendBtn.classList.add('hidden');
        voiceBtn.classList.remove('hidden');
        
        const tempId = `temp_${Date.now()}`;
        const tempMessage: Message = {
            _id: tempId,
            sender: state.currentUser!,
            messageType: 'text',
            content: content,
            createdAt: new Date().toISOString(),
            isSender: true,
            status: 'sending'
        };

        appendMessage(tempMessage, messagesContainer);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        addMessageToCache(state.currentConversationId, tempMessage);

        try {
            const newMessage = await apiFetch(`/api/v1/chat/conversations/${state.currentConversationId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ content, messageType: 'text' }),
            });
            
            appendMessage(newMessage, messagesContainer, tempId);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            updateMessageInCache(state.currentConversationId, tempId, newMessage);
            fetchAndRenderConversations(true, dom, state);

        } catch (error: any) {
            showLoginError('فشل إرسال الرسالة: ' + error.message);
            tempMessage.status = 'failed';
            appendMessage(tempMessage, messagesContainer, tempId);
            updateMessageInCache(state.currentConversationId, tempId, tempMessage);
        }
    }
}

export async function handleSendMedia(mediaType: 'image' | 'video', dom: any, state: any) {
    if (!state.currentConversationId) return;

    const isImage = mediaType === 'image';
    const file = isImage ? state.selectedImageFile : state.selectedVideoFile;
    const dataUrl = isImage ? state.selectedImageDataUrl : state.selectedVideoDataUrl;
    const captionInput = isImage ? dom.imageCaptionInput : dom.videoCaptionInput;
    const previewPage = isImage ? dom.imagePreviewPage : dom.videoPreviewPage;
    const previewElement = isImage ? dom.previewImage : dom.previewVideo;

    if (!file || !dataUrl) return;

    const caption = captionInput.value.trim();
    const tempId = `temp_${Date.now()}`;
    const tempMessage: Message = {
        _id: tempId,
        sender: state.currentUser!,
        messageType: mediaType,
        content: caption,
        mediaUrl: dataUrl,
        createdAt: new Date().toISOString(),
        isSender: true,
        status: 'sending',
        uploadProgress: 0,
    };
    
    previewPage.classList.add('hidden');
    dom.chatPage.classList.remove('hidden');
    appendMessage(tempMessage, dom.messagesContainer);
    dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    addMessageToCache(state.currentConversationId, tempMessage);

    const formData = new FormData();
    let endpoint = '';

    if (isImage) {
        formData.append('media', file);
        if (caption) {
            formData.append('content', caption);
        }
        formData.append('messageType', mediaType);
        endpoint = `/api/v1/chat/conversations/${state.currentConversationId}/media`;
    } else { // It's a video
        formData.append('video', file);
        if (caption) {
            formData.append('content', caption);
        }
        const videoDuration = dom.previewVideo?.duration;
        if (videoDuration && isFinite(videoDuration)) {
            formData.append('mediaDuration', Math.round(videoDuration).toString());
        }
        endpoint = `/api/v1/chat/conversations/${state.currentConversationId}/video`;
    }
    
    try {
        const newMessage = await uploadWithProgress(
            endpoint,
            formData,
            (percentage) => updateMessageProgress(tempId, percentage)
        );
        
        appendMessage(newMessage, dom.messagesContainer, tempId);
        dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
        updateMessageInCache(state.currentConversationId, tempId, newMessage);
        fetchAndRenderConversations(true, dom, state);
    } catch (error: any) {
        showLoginError(`فشل إرسال ${isImage ? 'الصورة' : 'الفيديو'}: ` + error.message);
        tempMessage.status = 'failed';
        appendMessage(tempMessage, dom.messagesContainer, tempId);
        updateMessageInCache(state.currentConversationId, tempId, tempMessage);
    } finally {
        if (isImage) {
            state.selectedImageFile = null;
            state.selectedImageDataUrl = null;
        } else {
            state.selectedVideoFile = null;
            state.selectedVideoDataUrl = null;
        }
        previewElement.src = '';
        captionInput.value = '';
    }
}


export async function openProfilePage(userId: string, conversationId: string, dom: any, state: any) {
    const { chatPage, profilePage } = dom;
    if(!chatPage || !profilePage) return;
    
    chatPage.classList.add('hidden');
    profilePage.classList.remove('hidden');

    const profileMain = profilePage.querySelector('main') as HTMLElement;
    const cachedProfile = getCachedProfile(userId, conversationId);

    if (cachedProfile) {
        renderProfileData(cachedProfile, dom, state);
        apiFetch(`/api/v1/chat/profile/${userId}?conversationId=${conversationId}`)
            .then(freshProfile => {
                renderProfileData(freshProfile, dom, state);
                setCachedProfile(userId, conversationId, freshProfile);
            }).catch(err => console.error('❌ Failed to update profile in background:', err));
    } else {
        try {
            if (profileMain) {
                showLoader(profileMain, 'جاري تحميل الملف الشخصي...');
            }
            const profile = await apiFetch(`/api/v1/chat/profile/${userId}?conversationId=${conversationId}`);

            if (profileMain) {
                 profileMain.innerHTML = `
                    <!-- Stats -->
                    <div class="grid grid-cols-3 gap-4">
                        <div class="text-center p-4 bg-gray-50 rounded-xl">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <i class="ri-message-3-line text-blue-500"></i>
                            </div>
                            <p id="profileMessagesCount" class="text-lg font-bold text-gray-900">0</p>
                            <p class="text-xs text-gray-500">رسالة</p>
                        </div>
                        <div class="text-center p-4 bg-gray-50 rounded-xl">
                            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <i class="ri-image-line text-green-500"></i>
                            </div>
                            <p id="profileImagesCount" class="text-lg font-bold text-gray-900">0</p>
                            <p class="text-xs text-gray-500">صورة</p>
                        </div>
                        <div class="text-center p-4 bg-gray-50 rounded-xl">
                            <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <i class="ri-links-line text-purple-500"></i>
                            </div>
                            <p id="profileLinksCount" class="text-lg font-bold text-gray-900">0</p>
                            <p class="text-xs text-gray-500">رابط</p>
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="space-y-4">
                        <div class="flex items-center p-4 bg-gray-50 rounded-xl">
                            <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center ml-3">
                                <i class="ri-information-line text-gray-600"></i>
                            </div>
                            <div class="flex-1">
                                <p class="font-medium text-gray-900">نبذة</p>
                                <p id="profileDescription" class="text-sm text-gray-600 mt-1">لا توجد نبذة</p>
                            </div>
                        </div>
                        <div class="flex items-center p-4 bg-gray-50 rounded-xl">
                            <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center ml-3">
                                <i class="ri-phone-line text-gray-600"></i>
                            </div>
                            <div class="flex-1">
                                <p class="font-medium text-gray-900">رقم الهاتف</p>
                                <p id="profilePhone" class="text-sm text-gray-600 mt-1" dir="ltr">غير متوفر</p>
                            </div>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="space-y-3">
                        <button id="profileSendMessageBtn" class="w-full flex items-center justify-center p-4 bg-primary text-white rounded-xl cursor-pointer !rounded-button">
                            <i class="ri-message-3-line ml-2"></i>
                            <span>إرسال رسالة</span>
                        </button>
                        <div class="grid grid-cols-2 gap-3">
                            <button class="flex items-center justify-center p-4 bg-gray-100 text-gray-700 rounded-xl cursor-pointer !rounded-button">
                                <i class="ri-phone-line ml-2"></i>
                                <span>اتصال صوتي</span>
                            </button>
                            <button class="flex items-center justify-center p-4 bg-gray-100 text-gray-700 rounded-xl cursor-pointer !rounded-button">
                                <i class="ri-vidicon-line ml-2"></i>
                                <span>اتصال مرئي</span>
                            </button>
                        </div>
                    </div>

                    <!-- Shared Media -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-semibold text-gray-900">الوسائط المشتركة</h3>
                            <button id="showAllMediaBtn" class="text-primary text-sm hidden">عرض الكل</button>
                        </div>
                        <div id="profileSharedMedia" class="grid grid-cols-3 gap-2">
                            <!-- Media will be populated here -->
                        </div>
                    </div>
                 `;
            }
            renderProfileData(profile, dom, state);
            setCachedProfile(userId, conversationId, profile);
        } catch (error: any) {
            showLoginError('فشل تحميل الملف الشخصي: ' + error.message);
            profilePage.classList.add('hidden');
            chatPage.classList.remove('hidden');
        }
    }
}

export function handleLogout(dom: any, state: any) {
    const { loginEmail, loginPassword, mainPage, chatPage, profilePage, voiceCallPage, videoCallPage, imagePreviewPage, loginPage, myProfilePage } = dom;
    
    if (state.backgroundSyncIntervalId) {
      clearInterval(state.backgroundSyncIntervalId);
      state.backgroundSyncIntervalId = null;
    }

    // We keep the cache but remove user-specific session data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    state.currentUser = null;
    state.currentConversationId = null;

    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    
    mainPage.classList.add('hidden');
    chatPage.classList.add('hidden');
    profilePage.classList.add('hidden');
    voiceCallPage.classList.add('hidden');
    videoCallPage.classList.add('hidden');
    imagePreviewPage.classList.add('hidden');
    if (myProfilePage) myProfilePage.classList.add('hidden');
    loginPage.classList.remove('hidden');
}

function getParticipantIdFromConversation(conversationId: string | null): string | null {
    if (!conversationId) return null;
    const conversations = getCachedConversations();
    const currentConvo = conversations?.find(c => c._id === conversationId);
    return currentConvo?.participant?._id || null;
}

export async function handleConversationClick(e: MouseEvent, dom: any, state: any) {
    const { mainPage, chatPage, chatUserName, chatAvatar, messagesContainer } = dom;
    const chatItem = (e.target as HTMLElement).closest('.chat-item');
    if (!chatItem) return;

    if (!mainPage || !chatPage || !chatUserName || !chatAvatar || !messagesContainer) return;
    
    const htmlItem = chatItem as HTMLElement;
    state.currentConversationId = htmlItem.dataset.conversationId || null;
    const userName = htmlItem.dataset.user;
    const userAvatar = htmlItem.dataset.avatar;
    
    if (!state.currentConversationId) return;

    const participantId = getParticipantIdFromConversation(state.currentConversationId);
    state.currentParticipantId = participantId;

    // --- NEW: Immediately set block status from cache to prevent UI flicker ---
    if (participantId) {
        const cachedBlockStatus = getBlockStatus(participantId);
        if (cachedBlockStatus) {
            state.isBlockedByYou = cachedBlockStatus.isBlocked && cachedBlockStatus.amITheBlocker;
            state.blockedByOther = cachedBlockStatus.isBlocked && !cachedBlockStatus.amITheBlocker;
        } else {
            // Default state if not in cache
            state.isBlockedByYou = false;
            state.blockedByOther = false;
        }
    }
    updateChatUIForBlockStatus(state, dom); // Update UI immediately based on cache

    chatUserName.textContent = userName || '';
    if(userAvatar) {
        chatAvatar.src = userAvatar;
        chatAvatar.alt = userName || '';
    }
    
    mainPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    
    // Fetch fresh block status and messages in the background
    if (participantId) {
        checkBlockStatus(participantId, state, dom); // This will run and update cache
    }
    
    await fetchAndRenderMessages(state.currentConversationId, dom);
}

export function handleBackToMain(dom: any, state: any) {
    const { chatPage, mainPage, messagesContainer, chatUserName, chatAvatar, messageInput, bottomNav } = dom;
    
    chatPage.classList.add('hidden');
    mainPage.classList.remove('hidden');
    if (bottomNav) bottomNav.classList.remove('hidden');
    setActiveTab('individuals');
    state.currentConversationId = null;
    state.currentParticipantId = null;
    state.isBlockedByYou = false;
    state.blockedByOther = false;
    
    if (messagesContainer) messagesContainer.innerHTML = '';
    if (chatUserName) chatUserName.textContent = '';
    if (chatAvatar) chatAvatar.src = '';
    if (messageInput) messageInput.value = '';
    handleMessageInput(dom);
    
    state.currentProfileSharedMedia = [];
}

export function handleMessageInput(dom: any) {
    const { messageInput, sendBtn, voiceBtn } = dom;
    if (!sendBtn || !voiceBtn) return;
    if (messageInput.value.trim()) {
        sendBtn.classList.remove('hidden');
        voiceBtn.classList.add('hidden');
    } else {
        sendBtn.classList.add('hidden');
        voiceBtn.classList.remove('hidden');
    }
}

export function handleAttachment(dom: any) {
    const { attachmentModal, attachmentSheet } = dom;
    if (!attachmentModal || !attachmentSheet) return;
    attachmentModal.classList.remove('hidden');
    setTimeout(() => {
        attachmentSheet.classList.remove('translate-y-full');
    }, 10);
}

function handleMediaSelection(mediaType: 'image' | 'video', dom: any, state: any) {
    const { chatPage, imagePreviewPage, previewImage, videoPreviewPage, previewVideo } = dom;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = `${mediaType}/*`;
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                
                if (mediaType === 'image') {
                    state.selectedImageFile = file;
                    state.selectedImageDataUrl = dataUrl;
                    if (previewImage) previewImage.src = dataUrl;
                    if (chatPage && imagePreviewPage) {
                        chatPage.classList.add('hidden');
                        imagePreviewPage.classList.remove('hidden');
                    }
                } else { // video
                    state.selectedVideoFile = file;
                    state.selectedVideoDataUrl = dataUrl;
                    if (previewVideo) previewVideo.src = dataUrl;
                    if (chatPage && videoPreviewPage) {
                        chatPage.classList.add('hidden');
                        videoPreviewPage.classList.remove('hidden');
                    }
                }
            };
            reader.readAsDataURL(file);
        }
        document.body.removeChild(fileInput);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
}

export function handleAttachmentClick(e: MouseEvent, dom: any, state: any) {
    const target = e.target as HTMLElement;
    const actionButton = target.closest('[data-action]');
    if (!actionButton) return;
    
    const action = actionButton.getAttribute('data-action');

    // Close modal before opening file picker
    document.getElementById('attachmentSheet')?.classList.add('translate-y-full');
    setTimeout(() => {
        document.getElementById('attachmentModal')?.classList.add('hidden');
    }, 300);

    if (action === 'pick-image') {
        handleMediaSelection('image', dom, state);
    } else if (action === 'pick-video') {
        handleMediaSelection('video', dom, state);
    }
}

export function handleCloseMediaPreview(dom: any, state: any) {
    const { imagePreviewPage, chatPage, previewImage, imageCaptionInput, videoPreviewPage, previewVideo, videoCaptionInput } = dom;
    if (imagePreviewPage) imagePreviewPage.classList.add('hidden');
    if (videoPreviewPage) videoPreviewPage.classList.add('hidden');
    if (chatPage) chatPage.classList.remove('hidden');

    // Reset image state
    state.selectedImageFile = null;
    state.selectedImageDataUrl = null;
    if (previewImage) previewImage.src = '';
    if (imageCaptionInput) imageCaptionInput.value = '';

    // Reset video state
    state.selectedVideoFile = null;
    state.selectedVideoDataUrl = null;
    if (previewVideo) previewVideo.src = '';
    if (videoCaptionInput) videoCaptionInput.value = '';
}

export function handleMoreOptions(dom: any) {
    const { moreOptionsModal, moreOptionsSheet } = dom;
    if (!moreOptionsModal || !moreOptionsSheet) return;
    moreOptionsModal.classList.remove('hidden');
    setTimeout(() => {
        moreOptionsSheet.classList.remove('translate-y-full');
    }, 10);
}

export function openCurrentUserProfile(dom: any, state: any) {
    if (state.currentConversationId) {
        const conversations = getCachedConversations();
        const currentConvo = conversations?.find(c => c._id === state.currentConversationId);
        if (currentConvo && currentConvo.participant) {
            openProfilePage(currentConvo.participant._id, state.currentConversationId, dom, state);
        }
    }
};

export function handleProfileBack(dom: any, state: any) {
    dom.profilePage.classList.add('hidden');
    dom.chatPage.classList.remove('hidden');
    // --- FIX: Clear shared media from the profile we just left ---
    state.currentProfileSharedMedia = [];
}

export function handleSendMessageFromProfile(dom: any) {
    dom.profilePage.classList.add('hidden');
    dom.chatPage.classList.remove('hidden');
}

export function handleShowAllMedia(dom: any, state: any) {
    const { profilePage, allMediaPage, allMediaGrid } = dom;
    if (profilePage && allMediaPage && allMediaGrid) {
        profilePage.classList.add('hidden');
        allMediaPage.classList.remove('hidden');
        
        allMediaGrid.innerHTML = ''; // Clear previous
        state.currentProfileSharedMedia.forEach((media: any) => {
            const mediaUrl = media.mediaUrl.startsWith('http') ? media.mediaUrl : `${API_BASE_URL}${media.mediaUrl}`;
            const imgContainer = document.createElement('div');
            imgContainer.className = "relative aspect-square";
            imgContainer.innerHTML = `
                <img src="${mediaUrl}" alt="Shared media" class="absolute inset-0 w-full h-full object-cover rounded-md cursor-pointer transition-transform hover:scale-105" onclick="window.open('${mediaUrl}', '_blank')">
            `;
            allMediaGrid.appendChild(imgContainer);
        });
    }
}

export function handleAllMediaBack(dom: any) {
    dom.allMediaPage.classList.add('hidden');
    dom.profilePage.classList.remove('hidden');
}

export function renderMyProfile(dom: any, state: any) {
    if (!state.currentUser || !dom.myProfilePage) return;

    const { 
        myProfileAvatar, myProfileName, myProfileEmail, 
        myProfileDescription, myProfilePhone,
        myProfileMessagesCount, myProfileImagesCount, myProfileLinksCount,
        myProfileSharedMedia
    } = dom;
    
    // --- Basic Info ---
    if (myProfileAvatar) myProfileAvatar.src = getAvatarUrl(state.currentUser);
    if (myProfileName) myProfileName.textContent = state.currentUser.name;
    if (myProfileEmail) myProfileEmail.textContent = state.currentUser.email;
    // Assuming these details would come from an API; using placeholders for now
    if (myProfileDescription) myProfileDescription.textContent = "مطور تطبيقات ومحب للتقنية. أسعى لتقديم أفضل تجربة للمستخدمين.";
    if (myProfilePhone) myProfilePhone.textContent = "+1 (555) 123-4567";

    // --- Calculate Stats and Gather Media from Cache ---
    let totalMessages = 0;
    let totalImages = 0;
    let totalLinks = 0;
    const allMyMedia: any[] = [];
    const linkRegex = /https?:\/\/[^\s]+/g;

    const conversations = getCachedConversations() || [];
    conversations.forEach(convo => {
        const messages = getCachedMessages(convo._id) || [];
        messages.forEach(msg => {
            totalMessages++;
            if (msg.messageType === 'image' || msg.messageType === 'video') {
                totalImages++;
                if (msg.mediaUrl) {
                    allMyMedia.push(msg);
                }
            }
            const links = msg.content.match(linkRegex);
            if (links) {
                totalLinks += links.length;
            }
        });
    });

    // --- Render Stats ---
    if (myProfileMessagesCount) myProfileMessagesCount.textContent = totalMessages.toString();
    if (myProfileImagesCount) myProfileImagesCount.textContent = totalImages.toString();
    if (myProfileLinksCount) myProfileLinksCount.textContent = totalLinks.toString();

    // --- Render Media ---
    if (myProfileSharedMedia) {
        myProfileSharedMedia.innerHTML = '';
        if (allMyMedia.length > 0) {
            allMyMedia
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Show newest first
                .slice(0, 9) // Limit to the latest 9 for the preview
                .forEach((media: any) => {
                    const img = document.createElement('img');
                    const mediaUrl = media.mediaUrl.startsWith('http') ? media.mediaUrl : `${API_BASE_URL}${media.mediaUrl}`;
                    img.src = mediaUrl;
                    img.className = 'w-full h-24 object-cover rounded-lg cursor-pointer transition-transform hover:scale-105';
                    img.onclick = () => window.open(mediaUrl, '_blank');
                    myProfileSharedMedia.appendChild(img);
                });
        } else {
            myProfileSharedMedia.innerHTML = '<p class="text-sm text-gray-500 col-span-3 text-center py-4">لا توجد وسائط لعرضها</p>';
        }
    }
}


export function handleMyProfileBack(dom: any) {
    if (!dom.myProfilePage || !dom.mainPage) return;

    dom.myProfilePage.classList.add('hidden');
    dom.mainPage.classList.remove('hidden');
    if (dom.bottomNav) dom.bottomNav.classList.remove('hidden');

    setActiveTab('individuals');
}


// --- NEW: Message Option Handlers ---

function closeMessageOptionsModal(dom: any, state: any) {
    if (!dom.messageOptionsSheet || !dom.messageOptionsModal) return;
    dom.messageOptionsSheet.classList.add('translate-y-full');
    setTimeout(() => {
        dom.messageOptionsModal.classList.add('hidden');
        state.selectedMessage = null;
    }, 300);
}

async function handleCopyMessage(dom: any, state: any) {
    if (!state.selectedMessage || state.selectedMessage.messageType !== 'text') return;
    try {
        await navigator.clipboard.writeText(state.selectedMessage.content);
        // Maybe show a small success toast later
        console.log("Message copied to clipboard");
    } catch (err) {
        console.error('Failed to copy message: ', err);
    }
}

async function handleEditMessage(dom: any, state: any) {
    if (!state.selectedMessage) return;
    
    const editDialog = document.getElementById('editMessageDialog');
    const editInput = document.getElementById('editMessageInput') as HTMLTextAreaElement;
    const confirmBtn = document.getElementById('confirmEditBtn');
    const cancelBtn = document.getElementById('cancelEditBtn');
    
    if (!editDialog || !editInput || !confirmBtn || !cancelBtn) {
        console.error('❌ Edit dialog elements not found');
        return;
    }
    
    console.log('📝 Opening edit dialog for message:', state.selectedMessage._id);
    
    // عرض النص الحالي
    editInput.value = state.selectedMessage.content;
    editDialog.classList.remove('hidden');
    editInput.focus();
    editInput.select();
    
    // إلغاء
    const handleCancel = () => {
        console.log('🚫 Edit cancelled');
        editDialog.classList.add('hidden');
    };
    
    // حفظ
    const handleConfirm = async () => {
        console.log('🔵 Confirm button clicked!');
        
        const newContent = editInput.value.trim();
        console.log('📝 New content:', newContent);
        
        if (!newContent) {
            showLoginError('الرجاء كتابة نص');
            return;
        }
        
        if (newContent === state.selectedMessage.content) {
            console.log('⚠️ Content unchanged, closing dialog');
            handleCancel();
            return;
        }
        
        const messageId = state.selectedMessage._id;
        const originalContent = state.selectedMessage.content;
        
        console.log('✏️ Updating UI immediately...');
        
        // --- IMMEDIATE UI UPDATE ---
        const messageEl = document.querySelector(`.message-bubble[data-id="${messageId}"]`);
        if (messageEl) {
            const p = messageEl.querySelector('p.text-sm');
            if (p) {
                p.textContent = newContent;
                
                // Add an "edited" label
                let editedSpan = messageEl.querySelector('.edited-label');
                if (!editedSpan) {
                    const timeSpan = messageEl.querySelector('.text-xs');
                    editedSpan = document.createElement('span');
                    editedSpan.className = 'edited-label text-xs opacity-75 mr-2';
                    editedSpan.textContent = '(معدّلة)';
                    timeSpan?.before(editedSpan);
                }
            }
            (messageEl as HTMLElement).dataset.content = newContent;
        }
        
        handleCancel();
        
        // --- HANDLE API CALL IN THE BACKGROUND ---
        try {
            console.log('🌐 Sending edit request to API...');
            
            const updatedMessage = await apiFetch(`/api/v1/chat/messages/${messageId}`, {
                method: 'PUT',
                body: JSON.stringify({ content: newContent })
            });
            
            console.log('✅ Message edited successfully');
            
            // Update cache
            updateMessageInCache(state.currentConversationId, messageId, updatedMessage);
            
        } catch (error: any) {
            console.error('❌ Error editing message:', error);
            showLoginError('فشل تعديل الرسالة: ' + error.message);
            
            // Revert UI on failure
            if (messageEl) {
                const p = messageEl.querySelector('p.text-sm');
                if (p) {
                    p.textContent = originalContent;
                }
                const editedSpan = messageEl.querySelector('.edited-label');
                if (editedSpan) editedSpan.remove();
                (messageEl as HTMLElement).dataset.content = originalContent;
            }
        }
    };
    
    // استخدام { once: true } لمنع تكرار Event Listeners
    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
    
    // إغلاق عند الضغط على الخلفية
    const handleBackgroundClick = (e: Event) => {
        if (e.target === editDialog) {
            handleCancel();
        }
    };
    editDialog.addEventListener('click', handleBackgroundClick, { once: true });
}


async function handleDeleteMessage(scope: 'me' | 'everyone', dom: any, state: any) {
    if (!state.selectedMessage || !state.currentConversationId) return;
    const messageId = state.selectedMessage._id;
    const endpoint = scope === 'everyone' ? `/api/v1/chat/messages/${messageId}?scope=all` : `/api/v1/chat/messages/${messageId}`;

    try {
        await apiFetch(endpoint, { method: 'DELETE' });
        
        const messageEl = document.querySelector(`.message-bubble[data-id="${messageId}"]`)?.parentElement;
        if (messageEl) {
            if (scope === 'everyone') {
                const deletedNotice = document.createElement('div');
                deletedNotice.className = 'flex justify-center my-2';
                deletedNotice.innerHTML = `<div class="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">تم حذف هذه الرسالة</div>`;
                messageEl.replaceWith(deletedNotice);
            } else {
                messageEl.remove();
            }
        }
        
        // Update cache
        const messages = getCachedMessages(state.currentConversationId) || [];
        const updatedMessages = messages.filter(m => m._id !== messageId);
        setCachedMessages(state.currentConversationId, updatedMessages);

    } catch (error) {
        showLoginError('فشل حذف الرسالة: ' + (error as Error).message);
    }
}

export function handleMessageLongPress(messageEl: HTMLElement, dom: any, state: any) {
    const messageId = messageEl.dataset.id;
    if (!messageId || !state.currentConversationId) return;

    const cachedMessages = getCachedMessages(state.currentConversationId);
    const message = cachedMessages?.find(m => m._id === messageId);

    if (!message) return;

    state.selectedMessage = message; // Store the full message object
    
    renderMessageOptions(message, dom);
    
    if (dom.messageOptionsModal && dom.messageOptionsSheet) {
        dom.messageOptionsModal.classList.remove('hidden');
        setTimeout(() => {
            dom.messageOptionsSheet.classList.remove('translate-y-full');
        }, 10);
    }
}

export function handleMessageOptionClick(e: MouseEvent, dom: any, state: any) {
    const target = e.target as HTMLElement;
    const actionButton = target.closest('[data-action]');
    if (!actionButton || !state.selectedMessage) return;
    
    const action = actionButton.getAttribute('data-action');
    
    console.log('🎯 Action selected:', action);
    console.log('📝 Selected message:', state.selectedMessage);
    
    // حفظ الرسالة المحددة قبل إغلاق Modal
    const selectedMessage = { ...state.selectedMessage };

    // إغلاق Modal
    closeMessageOptionsModal(dom, state);

    // تنفيذ الإجراء مع الرسالة المحفوظة
    const tempState = { ...state, selectedMessage };

    switch (action) {
        case 'copy-message':
            handleCopyMessage(dom, tempState);
            break;
        case 'edit-message':
            handleEditMessage(dom, tempState);
            break;
        case 'delete-me':
            handleDeleteMessage('me', dom, tempState);
            break;
        case 'delete-everyone':
            handleDeleteMessage('everyone', dom, tempState);
            break;
    }
}


// Helper to open a chat page programmatically
export async function openChatPage(conversationId: string, dom: any, state: any) {
    const { mainPage, chatPage, chatUserName, chatAvatar, messagesContainer, notificationsPage, bottomNav } = dom;

    const cachedConversations = getCachedConversations();
    const conversation = cachedConversations?.find(c => c._id === conversationId);

    if (!conversation) {
      showLoginError('لم يتم العثور على المحادثة');
      return;
    }

    // --- Clear previous content immediately to prevent stale data flash ---
    if(messagesContainer) messagesContainer.innerHTML = '';
    
    state.currentConversationId = conversationId;
    const userName = conversation.participant.name;
    const userAvatar = getAvatarUrl(conversation.participant);
    
    if(chatUserName) chatUserName.textContent = userName || '';
    if(chatAvatar) {
      chatAvatar.src = userAvatar;
      chatAvatar.alt = userName || '';
    }
    
    if(mainPage) mainPage.classList.add('hidden');
    if(notificationsPage) notificationsPage.classList.add('hidden');
    if(chatPage) chatPage.classList.remove('hidden');
    if(bottomNav) bottomNav.classList.add('hidden'); // Hide nav when in a chat

    await fetchAndRenderMessages(conversationId, dom);
    if(messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

// Function to fetch and render call logs
export async function loadCallLogs(dom: any, state: any) {
    const callLogLoader = document.getElementById('callLogLoader');
    const callLogContainer = document.getElementById('callLogContainer');
    const callLogEmpty = document.getElementById('callLogEmpty');
    
    if (!callLogContainer || !callLogLoader || !callLogEmpty) return;
    
    try {
      callLogLoader.classList.remove('hidden');
      callLogContainer.classList.add('hidden');
      callLogEmpty.classList.add('hidden');
      
      console.log('📞 Fetching call logs...');
      const callLogs: any[] = await apiFetch('/api/v1/call-logs');
      console.log('✅ Call logs loaded:', callLogs.length);
      
      callLogLoader.classList.add('hidden');
      
      if (!callLogs || callLogs.length === 0) {
        callLogEmpty.classList.remove('hidden');
        return;
      }
      
      callLogContainer.classList.remove('hidden');
      callLogContainer.innerHTML = '';
      
      const currentUserId = state.currentUser?._id;
      
      callLogs.forEach((log: any) => {
        const isOutgoing = log.caller._id === currentUserId;
        const otherUser = isOutgoing ? log.receiver : log.caller;
        
        const callIcon = log.callType === 'video' ? 'ri-vidicon-fill' : 'ri-phone-fill';
        const iconColor = log.callType === 'video' ? 'text-purple-500' : 'text-blue-500';
        const bgColor = log.callType === 'video' ? 'bg-purple-100' : 'bg-blue-100';
        
        const callDirection = isOutgoing 
          ? '<i class="ri-arrow-left-up-line text-green-500 text-sm"></i> صادرة' 
          : '<i class="ri-arrow-right-down-line text-blue-500 text-sm"></i> واردة';
        
        const duration = log.duration || 0;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationText = duration > 0 
          ? `${minutes}:${seconds.toString().padStart(2, '0')} دقيقة` 
          : 'لم يتم الرد';
        
        const callDate = new Date(log.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - callDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let timeText = '';
        if (diffMins < 1) {
          timeText = 'الآن';
        } else if (diffMins < 60) {
          timeText = `منذ ${diffMins} دقيقة`;
        } else if (diffHours < 24) {
          timeText = `منذ ${diffHours} ساعة`;
        } else if (diffDays === 1) {
          timeText = 'أمس';
        } else if (diffDays < 7) {
          timeText = `منذ ${diffDays} يوم`;
        } else {
          // FIX: Corrected typo from toLocaleDate to toLocaleDateString.
          timeText = callDate.toLocaleDateString('ar');
        }
        
        const callItem = document.createElement('div');
        callItem.className = 'flex items-start p-4 bg-gray-50/70 rounded-xl hover:bg-gray-100 transition cursor-pointer';
        callItem.innerHTML = `
          <div class="w-10 h-10 ${bgColor} rounded-full flex items-center justify-center ml-3 flex-shrink-0">
            <i class="${callIcon} ${iconColor} text-lg"></i>
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-900">${otherUser.name}</h4>
              <span class="text-xs text-gray-400">${timeText}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-sm text-gray-600">${callDirection}</span>
              <span class="text-gray-300">•</span>
              <span class="text-sm text-gray-600">${log.callType === 'video' ? 'مرئية' : 'صوتية'}</span>
            </div>
            <p class="text-sm text-gray-500 mt-1">${durationText}</p>
          </div>
        `;
        
        callItem.addEventListener('click', () => {
          const conversations = getCachedConversations();
          const conversation = conversations?.find(c => c.participant._id === otherUser._id);
          if (conversation) {
            openChatPage(conversation._id, dom, state);
          } else {
            showLoginError('لم يتم العثور على المحادثة');
          }
        });
        
        callLogContainer.appendChild(callItem);
      });
      
    } catch (error: any) {
      console.error('❌ Error loading call logs:', error);
      
      if (callLogLoader) callLogLoader.classList.add('hidden');
      
      if (callLogContainer) {
        callLogContainer.classList.remove('hidden');
        callLogContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center py-20">
            <i class="ri-error-warning-line text-5xl text-red-500 mb-4"></i>
            <p class="text-gray-900 font-medium">فشل تحميل السجل</p>
            <p class="text-gray-500 text-sm mt-2">${error.message}</p>
            <button onclick="window.loadCallLogs()" class="mt-4 px-6 py-2 bg-primary text-white rounded-lg !rounded-button">
              إعادة المحاولة
            </button>
          </div>
        `;
      }
    }
  }

// --- NEW: Block/Unblock UI and Logic ---

export function updateChatUIForBlockStatus(state: any, dom: any) {
    const { normalInputContainer, blockedNotice, blockActions, voiceCallBtn, videoCallBtn } = dom;

    if (!normalInputContainer || !blockedNotice || !blockActions || !voiceCallBtn || !videoCallBtn) return;

    const isBlocked = state.isBlockedByYou || state.blockedByOther;

    normalInputContainer.classList.toggle('hidden', isBlocked);
    // Assuming voice/video are inside a container that can be hidden
    const callButtonsContainer = voiceCallBtn.closest('.flex.gap-2');
    if(callButtonsContainer) {
        (callButtonsContainer as HTMLElement).classList.toggle('hidden', isBlocked);
    }


    blockActions.classList.toggle('hidden', !state.isBlockedByYou);
    blockedNotice.classList.toggle('hidden', !state.blockedByOther);

    if (state.isBlockedByYou) {
        blockedNotice.classList.add('hidden');
    }
}


export async function checkBlockStatus(userId: string, state: any, dom: any) {
    try {
        const status = await apiFetch(`/api/v1/chat/block-status/${userId}`);
        
        state.isBlockedByYou = status.isBlocked && status.amITheBlocker;
        state.blockedByOther = status.isBlocked && !status.amITheBlocker;

        setBlockStatus(userId, status); // Update the cache
        updateChatUIForBlockStatus(state, dom);

    } catch (error) {
        console.error('❌ Error checking block status:', error);
        // Don't change state on error, rely on cached/default values
    }
}


export async function handleBlockUser(userId: string, state: any, dom: any) {
    try {
        console.log('🚫 Blocking user:', userId);
        
        // Optimistic UI Update
        state.isBlockedByYou = true;
        state.blockedByOther = false; 
        updateChatUIForBlockStatus(state, dom);
        
        // Update cache immediately
        setBlockStatus(userId, { isBlocked: true, amITheBlocker: true });

        await apiFetch(`/api/v1/chat/block/${userId}`, {
            method: 'POST'
        });

        console.log('✅ User blocked successfully');
        showToast('تم حظر المستخدم بنجاح');

    } catch (error: any) {
        console.error('❌ Error blocking user:', error);
        showLoginError('فشل حظر المستخدم: ' + error.message);

        // Revert UI on failure
        state.isBlockedByYou = false;
        updateChatUIForBlockStatus(state, dom);
        setBlockStatus(userId, { isBlocked: false, amITheBlocker: false });
    }
}

export async function handleUnblockUser(userId: string, state: any, dom: any) {
    try {
        console.log('✅ Unblocking user:', userId);

        // Optimistic UI Update
        state.isBlockedByYou = false;
        state.blockedByOther = false;
        updateChatUIForBlockStatus(state, dom);

        // Update cache immediately
        setBlockStatus(userId, { isBlocked: false, amITheBlocker: false });

        await apiFetch(`/api/v1/chat/unblock/${userId}`, {
            method: 'POST'
        });

        console.log('✅ User unblocked successfully');
        showToast('تم فك حظر المستخدم');

    } catch (error: any) {
        console.error('❌ Error unblocking user:', error);
        showLoginError('فشل فك الحظر: ' + error.message);
        
        // Revert UI on failure
        state.isBlockedByYou = true;
        updateChatUIForBlockStatus(state, dom);
        setBlockStatus(userId, { isBlocked: true, amITheBlocker: true });
    }
}

export async function handleReportChat(targetId: string) {
     try {
        await apiFetch('/api/v1/reports', {
            method: 'POST',
            body: JSON.stringify({
                reportType: 'user', 
                targetId: targetId,
                reason: 'communication_issue',
                details: 'إبلاغ عن محتوى المحادثة'
            })
        });
        showToast('تم إرسال البلاغ عن الدردشة بنجاح');
    } catch (error: any) {
        showLoginError('فشل إرسال البلاغ: ' + error.message);
    }
}

// --- NEW: Call Log Badge Functions ---

/**
 * Fetch unread call count from API and update badge
 */
export async function fetchAndUpdateCallLogBadge() {
    try {
        const response = await apiFetch('/api/v1/call-logs/unread-count');
        const count = response.count || 0;
        updateCallLogBadge(count);
    } catch (error: any) {
        console.error('❌ Error fetching unread call count:', error);
        // Silently fail - don't show error to user
    }
}

/**
 * Update the call log badge UI
 */
export function updateCallLogBadge(count: number) {
    const badge = document.getElementById('callLogBadge');
    if (!badge) return;
    
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count.toString();
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Mark all call logs as read and hide badge
 */
export async function markAllCallLogsAsRead() {
    try {
        await apiFetch('/api/v1/call-logs/mark-all-read', {
            method: 'PUT'
        });
        updateCallLogBadge(0);
        console.log('✅ All call logs marked as read');
    } catch (error: any) {
        console.error('❌ Error marking call logs as read:', error);
        // Silently fail
    }
}

