import type { User, Conversation, Message } from './types.js';
import { API_BASE_URL } from './api.js';

// --- HELPER FUNCTION FOR AVATARS ---
export function getAvatarUrl(user: User | null): string {
  if (!user) {
    return 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff&size=128&bold=true';
  }
  
  if (user.avatar && user.avatar.trim() !== '') {
    return user.avatar;
  }
  
  const name = encodeURIComponent(user.name || 'User');
  return `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff&size=128&bold=true`;
}

// --- UTILITY & RENDER FUNCTIONS ---
export function showLoader(container: HTMLElement, message: string = 'Loading...') {
    container.innerHTML = `<div class="flex justify-center items-center h-full pt-10"><div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div><p class="ml-4 text-gray-500">${message}</p></div>`;
}

export function formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export function showToast(message: string, type: 'success' | 'error' = 'success') {
    const toastDiv = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-secondary' : 'bg-red-500';
    // Use a high z-index to appear over modals
    toastDiv.className = `fixed top-4 left-1/2 transform -translate-x-1/2 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-[150]`;
    toastDiv.style.animation = 'fadeIn 0.5s ease-out forwards';
    toastDiv.textContent = message;
    document.body.appendChild(toastDiv);

    setTimeout(() => {
        // Simple removal, no exit animation to keep it simple
        toastDiv.remove();
    }, 3000);
}

export function showLoginError(message: string) {
    showToast(message, 'error');
}

export function renderConversations(conversations: Conversation[], conversationsContainer: HTMLElement) {
    if (!conversationsContainer) return;
    conversationsContainer.innerHTML = ''; // Clear mock data
    if (conversations.length === 0) {
    conversationsContainer.innerHTML = `
        <div class="text-center pt-10">
        <div class="text-6xl mb-4">💬</div>
        <p class="text-gray-700 font-semibold mb-2">لا توجد محادثات بعد</p>
        <p class="text-gray-500 text-sm">ابدأ محادثة جديدة مع مستخدم آخر</p>
        </div>
    `;
    return;
    }

    conversations.forEach(convo => {
        const otherParticipant = convo.participant;
        if (!otherParticipant) return;

        let lastMessageText = convo.lastMessage?.content ?? 'ابدأ المحادثة';
        if (convo.lastMessage) {
        switch (convo.lastMessage.messageType) {
            case 'image':
                lastMessageText = '📷 صورة';
                break;
            case 'video':
                lastMessageText = '📹 فيديو';
                break;
            case 'file':
                lastMessageText = '📄 ملف';
                break;
        }
        }
        
        const lastMessageTime = formatTime(convo.lastMessage?.createdAt);
        const avatarUrl = getAvatarUrl(otherParticipant);

        const convoElement = document.createElement('div');
        convoElement.className = 'chat-item flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer';
        convoElement.dataset.conversationId = convo._id;
        convoElement.dataset.user = otherParticipant.name;
        convoElement.dataset.avatar = avatarUrl;
        
        convoElement.innerHTML = `
            <div class="relative ml-3">
                <img src="${avatarUrl}" alt="${otherParticipant.name}" class="w-12 h-12 rounded-full object-cover">
                <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
            </div>
            <div class="flex-1">
                <div class="flex justify-between items-start mb-1">
                    <h3 class="font-semibold text-gray-900">${otherParticipant.name}</h3>
                    <span class="last-message-time text-xs text-gray-500">${lastMessageTime}</span>
                </div>
                <p class="last-message-content text-sm text-gray-600 truncate">${lastMessageText}</p>
            </div>
        `;
        conversationsContainer.appendChild(convoElement);
    });
}

export function renderMessages(messages: Message[], messagesContainer: HTMLElement) {
    if (!messagesContainer) return;
    messagesContainer.innerHTML = ''; // Clear previous messages

    if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = `
        <div class="flex justify-center items-center h-full empty-chat-placeholder">
        <div class="text-center">
            <div class="text-6xl mb-4">👋</div>
            <p class="text-gray-700 font-semibold mb-2">ابدأ المحادثة</p>
            <p class="text-gray-500 text-sm">اكتب رسالتك الأولى أدناه</p>
        </div>
        </div>
    `;
    return;
    }

    messages.forEach(msg => {
        appendMessage(msg, messagesContainer);
    });
}

export function updateMessageProgress(messageId: string, percentage: number) {
    const messageElement = document.querySelector(`[data-id="${messageId}"]`);
    if (!messageElement) return;
    
    const progressText = messageElement.querySelector('.progress-text') as HTMLElement;
    if (progressText) {
        progressText.textContent = `${percentage}%`;
    }
    
    const progressPath = messageElement.querySelector('.progress-path') as SVGCircleElement;
    if (progressPath) {
        progressPath.setAttribute('stroke-dasharray', `${percentage}, 100`);
    }
}

export function appendMessage(msg: Message, messagesContainer: HTMLElement, tempIdToReplace?: string) {
    if (!messagesContainer) return;

    if (tempIdToReplace && (msg.messageType === 'image' || msg.messageType === 'video')) {
        const tempEl = messagesContainer.querySelector(`[data-id="${tempIdToReplace}"]`) as HTMLElement;
        if (tempEl) {
            tempEl.dataset.id = msg._id;
            const loader = tempEl.querySelector('.loader-overlay');
            if (loader) loader.remove();
            
            const mediaEl = tempEl.querySelector('img, video') as HTMLImageElement | HTMLVideoElement;
            if (mediaEl) {
                let serverUrl = msg.mediaUrl || '';
                if (!serverUrl.startsWith('http') && !serverUrl.startsWith('data:')) {
                    serverUrl = serverUrl.startsWith('/') ? `${API_BASE_URL}${serverUrl}` : `${API_BASE_URL}/${serverUrl}`;
                }
                if (mediaEl.src !== serverUrl) {
                    mediaEl.src = serverUrl;
                }
                mediaEl.classList.remove('opacity-60', 'filter', 'blur-sm');
                mediaEl.classList.add('cursor-pointer');
                mediaEl.onclick = () => window.open(serverUrl, '_blank');
                mediaEl.onerror = () => { (mediaEl as HTMLImageElement).src='https://via.placeholder.com/300x200?text=Media+Not+Found' };
            }

            const statusIcon = tempEl.querySelector('.ri-time-line');
            if (statusIcon) statusIcon.remove();
            
            const timeElements = tempEl.querySelectorAll('.text-xs');
            const timeSpan = Array.from(timeElements).pop() as HTMLElement;
            if (timeSpan) {
                timeSpan.textContent = formatTime(msg.createdAt);
            }
            return;
        }
    }

    const placeholder = messagesContainer.querySelector('.empty-chat-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const isSender = msg.isSender;
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${isSender ? 'justify-end' : 'justify-start'}`;
    
    const time = formatTime(msg.createdAt);
    let statusIndicatorHTML = '';
    if (isSender && msg.status) {
        if (msg.status === 'sending') {
            statusIndicatorHTML = `<i class="ri-time-line text-xs opacity-75 mr-1"></i>`;
        } else if (msg.status === 'failed') {
            statusIndicatorHTML = `<i class="ri-error-warning-line text-xs text-red-400 mr-1" title="Failed to send"></i>`;
        }
    }

    let messageContentHTML = '';

    const loaderOverlay = msg.status === 'sending' ? `
        <div class="loader-overlay absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center rounded-lg">
            <div class="flex flex-col items-center">
                <svg class="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <circle class="text-gray-400" stroke="currentColor" stroke-width="3" fill="none" cx="18" cy="18" r="15.9155" />
                    <circle class="progress-path text-white transition-all duration-300" stroke="currentColor" stroke-width="3" fill="none" cx="18" cy="18" r="15.9155" stroke-dasharray="${msg.uploadProgress || 0}, 100" stroke-linecap="round" />
                </svg>
                <span class="progress-text text-white text-sm font-bold mt-2">${msg.uploadProgress || 0}%</span>
            </div>
        </div>` : '';
    const mediaOpacity = msg.status === 'sending' ? 'opacity-60 filter blur-sm' : '';

    
    if (msg.messageType === 'image' || msg.messageType === 'video') {
        let mediaUrl = msg.mediaUrl || '';
        if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:')) {
            mediaUrl = mediaUrl.startsWith('/') ? `${API_BASE_URL}${mediaUrl}` : `${API_BASE_URL}/${mediaUrl}`;
        }
        
        const clickable = msg.status === 'sending' ? '' : `onclick="window.open('${mediaUrl}', '_blank')"`;
        const mediaTag = msg.messageType === 'image'
            ? `<img src="${mediaUrl}" alt="Image" class="w-full h-auto rounded-lg ${msg.status !== 'sending' ? 'cursor-pointer' : ''} ${mediaOpacity}" ${clickable} onerror="this.src='https://via.placeholder.com/300x200?text=Image+Not+Found'">`
            : `<video src="${mediaUrl}" controls class="w-full h-auto rounded-lg ${msg.status !== 'sending' ? 'cursor-pointer' : ''} ${mediaOpacity}" ${clickable} onerror="this.poster='https://via.placeholder.com/300x200?text=Video+Not+Found'"></video>`;

        messageContentHTML = `
            <div class="relative ${isSender ? 'bg-primary text-white' : 'bg-gray-100'} rounded-2xl ${isSender ? 'rounded-bl-sm' : 'rounded-br-sm'} max-w-xs overflow-hidden p-1">
                <div class="relative">
                     ${mediaTag}
                    ${loaderOverlay}
                </div>
                ${msg.content ? `<p class="text-sm px-2 pt-2 ${!isSender ? 'text-gray-900' : ''}" style="word-break: break-word;">${msg.content}</p>` : ''}
                <div class="flex items-center justify-end mt-1 px-2 pb-1">
                    ${statusIndicatorHTML}
                    <span class="text-xs ${isSender ? 'opacity-75' : 'text-gray-500'}">${time}</span>
                </div>
            </div>`;
    } else { // 'text' or default
        messageContentHTML = `
            <div class="${isSender ? 'bg-primary text-white rounded-bl-sm' : 'bg-gray-100 text-gray-900 rounded-br-sm'} px-4 py-2 rounded-2xl max-w-xs">
                <p class="text-sm" style="word-break: break-word;">${msg.content}</p>
                <div class="flex items-center justify-end mt-1">
                    ${statusIndicatorHTML}
                    <span class="text-xs ${isSender ? 'opacity-75' : 'text-gray-500'}">${time}</span>
                </div>
            </div>`;
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.dataset.id = msg._id;
    bubble.dataset.timestamp = msg.createdAt;
    bubble.dataset.messagetype = msg.messageType;
    bubble.dataset.issender = String(msg.isSender);
    bubble.dataset.content = msg.content; // Store content for copy
    bubble.innerHTML = messageContentHTML;
    
    messageDiv.appendChild(bubble);

    if (tempIdToReplace) {
        const tempEl = messagesContainer.querySelector(`[data-id="${tempIdToReplace}"]`);
        if (tempEl) {
            tempEl.parentElement?.replaceWith(messageDiv);
            return;
        }
    }

    messagesContainer.appendChild(messageDiv);
}


export function renderMessageOptions(message: Message, dom: any) {
    if (!dom.messageOptionsContainer) return;

    dom.messageOptionsContainer.innerHTML = ''; // Clear previous options

    const now = new Date();
    const messageDate = new Date(message.createdAt);
    const diffSeconds = (now.getTime() - messageDate.getTime()) / 1000;
    const diffHours = diffSeconds / 3600;

    const options: { icon: string, iconColor: string, bgColor: string, title: string, subtitle: string, action: string }[] = [];

    // Edit option
    if (message.isSender && message.messageType === 'text' && diffSeconds <= 30) {
        options.push({
            icon: 'ri-pencil-line', iconColor: 'text-blue-500', bgColor: 'bg-blue-100',
            title: 'تعديل', subtitle: 'متاح لمدة 30 ثانية فقط', action: 'edit-message'
        });
    }

    // Copy option
    if (message.messageType === 'text') {
        options.push({
            icon: 'ri-file-copy-line', iconColor: 'text-green-500', bgColor: 'bg-green-100',
            title: 'نسخ', subtitle: 'نسخ نص الرسالة إلى الحافظة', action: 'copy-message'
        });
    }

    // Delete for Everyone option
    if (message.isSender && diffHours <= 24) {
        options.push({
            icon: 'ri-delete-bin-2-line', iconColor: 'text-yellow-600', bgColor: 'bg-yellow-100',
            title: 'حذف لدى الجميع', subtitle: 'متاح لمدة 24 ساعة فقط', action: 'delete-everyone'
        });
    }
    
    // Delete for Me option
    options.push({
        icon: 'ri-delete-bin-6-line', iconColor: 'text-red-500', bgColor: 'bg-red-100',
        title: 'حذف', subtitle: 'حذف الرسالة من عندك فقط', action: 'delete-me'
    });

    // Render all applicable options
    options.forEach(opt => {
        const optionEl = document.createElement('button');
        optionEl.className = 'w-full flex items-center p-4 rounded-xl hover:bg-gray-50 cursor-pointer text-right';
        optionEl.dataset.action = opt.action;
        optionEl.innerHTML = `
            <div class="w-10 h-10 ${opt.bgColor} rounded-full flex items-center justify-center ml-3">
                <i class="${opt.icon} ${opt.iconColor} text-lg"></i>
            </div>
            <div class="flex-1">
                <h4 class="font-medium text-gray-900">${opt.title}</h4>
                <p class="text-sm text-gray-500">${opt.subtitle}</p>
            </div>
        `;
        dom.messageOptionsContainer.appendChild(optionEl);
    });
}

export function renderProfileData(profile: any, dom: any, state: any) {
    if (!dom.profilePage) return;
    const { profilePage } = dom;

    const coverImage = profilePage.querySelector('#profileCoverImage') as HTMLElement;
    if (coverImage) {
        if (profile.userType === 'company' && profile.coverImage) {
            const coverUrl = profile.coverImage.startsWith('http') ? profile.coverImage : `${API_BASE_URL}${profile.coverImage}`;
            coverImage.style.backgroundImage = `url('${coverUrl}')`;
            coverImage.className = 'h-40';
            coverImage.style.backgroundSize = 'cover';
            coverImage.style.backgroundPosition = 'center';
        } else {
            coverImage.style.backgroundImage = '';
            coverImage.className = 'h-40 bg-gradient-to-br from-blue-400 to-purple-500';
        }
    }

    const avatar = profilePage.querySelector('#profileAvatar') as HTMLImageElement;
    if (avatar) avatar.src = getAvatarUrl(profile);

    const nameElement = profilePage.querySelector('#profileName') as HTMLElement;
    if (nameElement) nameElement.textContent = profile.name || '';

    const userTypeElement = profilePage.querySelector('#profileUserType') as HTMLElement;
    if (userTypeElement) userTypeElement.textContent = profile.userType === 'company' ? 'شركة نقل' : 'فرد';

    const description = profilePage.querySelector('#profileDescription') as HTMLElement;
    if (description) description.textContent = profile.description || 'لا توجد نبذة';

    const phone = profilePage.querySelector('#profilePhone') as HTMLElement;
    if (phone) phone.textContent = profile.phone || 'غير متوفر';

    if (profile.conversationStats) {
        const messagesCount = profilePage.querySelector('#profileMessagesCount') as HTMLElement;
        if (messagesCount) messagesCount.textContent = profile.conversationStats.messagesCount.toString();
        
        const imagesCount = profilePage.querySelector('#profileImagesCount') as HTMLElement;
        if (imagesCount) imagesCount.textContent = profile.conversationStats.imagesCount.toString();

        const linksCount = profilePage.querySelector('#profileLinksCount') as HTMLElement;
        if (linksCount) linksCount.textContent = profile.conversationStats.linksCount.toString();
    }

    const sharedMediaContainer = profilePage.querySelector('#profileSharedMedia') as HTMLElement;
    const showAllMediaBtn = document.getElementById('showAllMediaBtn') as HTMLElement;
    
    if (sharedMediaContainer && showAllMediaBtn) {
        sharedMediaContainer.innerHTML = '';
        state.currentProfileSharedMedia = profile.sharedMedia || []; // Store all media

        if (state.currentProfileSharedMedia.length > 0) {
            const mediaToShow = state.currentProfileSharedMedia.slice(0, 3);
            mediaToShow.forEach((media: any) => {
                const img = document.createElement('img');
                const mediaUrl = media.mediaUrl.startsWith('http') ? media.mediaUrl : `${API_BASE_URL}${media.mediaUrl}`;
                img.src = mediaUrl;
                img.className = 'w-full h-24 object-cover rounded-lg cursor-pointer';
                img.onclick = () => window.open(mediaUrl, '_blank');
                sharedMediaContainer.appendChild(img);
            });

            if (state.currentProfileSharedMedia.length > 3) {
                showAllMediaBtn.classList.remove('hidden');
            } else {
                showAllMediaBtn.classList.add('hidden');
            }
        } else {
            sharedMediaContainer.innerHTML = '<p class="text-sm text-gray-500 col-span-3 text-center py-4">لا توجد وسائط مشتركة</p>';
            showAllMediaBtn.classList.add('hidden');
        }
    }
}

export function setActiveTab(tabName: string) {
    const tabBtns = document.querySelectorAll<HTMLElement>('.tab-btn');
    tabBtns.forEach(btn => {
        const isTargetTab = btn.dataset.tab === tabName;
        btn.classList.toggle('active', isTargetTab);

        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (icon) {
            icon.classList.toggle('text-primary', isTargetTab);
            icon.classList.toggle('text-gray-400', !isTargetTab);
        }
        if (text) {
            text.classList.toggle('text-primary', isTargetTab);
            text.classList.toggle('font-medium', isTargetTab);
            text.classList.toggle('text-gray-400', !isTargetTab);
        }
    });
}
