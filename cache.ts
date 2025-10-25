
import type { Conversation, Message, BlockStatus } from './types.js';

// --- CACHE HELPERS ---
const CONVERSATIONS_CACHE_KEY = 'conversationsCache';
const getMessagesCacheKey = (conversationId: string) => `messages_${conversationId}`;
const getProfileCacheKey = (userId: string, conversationId: string) => `profile_${userId}_${conversationId}`;
const getBlockStatusCacheKey = (userId: string) => `block_status_${userId}`;


function getCachedData<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function setCachedData<T>(key: string, data: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to write to cache", e);
    }
}

export function getCachedConversations(): Conversation[] | null {
    return getCachedData<Conversation[]>(CONVERSATIONS_CACHE_KEY);
}

export function setCachedConversations(conversations: Conversation[]): void {
    setCachedData(CONVERSATIONS_CACHE_KEY, conversations);
}

export function getCachedMessages(conversationId: string): Message[] | null {
    return getCachedData<Message[]>(getMessagesCacheKey(conversationId));
}

export function setCachedMessages(conversationId: string, messages: Message[]): void {
    setCachedData(getMessagesCacheKey(conversationId), messages);
}

export function getCachedProfile(userId: string, conversationId:string): any | null {
    return getCachedData<any>(getProfileCacheKey(userId, conversationId));
}

export function setCachedProfile(userId: string, conversationId:string, profile: any): void {
    setCachedData(getProfileCacheKey(userId, conversationId), profile);
}

export function addMessageToCache(conversationId: string, message: Message): void {
    const messages = getCachedMessages(conversationId) || [];
    messages.push(message);
    setCachedMessages(conversationId, messages);
}

export function updateMessageInCache(conversationId: string, tempOrRealId: string, newMessage: Message): void {
    const messages = getCachedMessages(conversationId) || [];
    const index = messages.findIndex(m => m._id === tempOrRealId);
    if (index !== -1) {
        messages[index] = newMessage;
    } else {
        messages.push(newMessage);
    }
    setCachedMessages(conversationId, messages);
}

// --- BLOCK STATUS CACHE ---
export function getBlockStatus(userId: string): BlockStatus | null {
    if (!userId) return null;
    return getCachedData<BlockStatus>(getBlockStatusCacheKey(userId));
}

export function setBlockStatus(userId: string, status: BlockStatus): void {
    if (!userId) return;
    setCachedData(getBlockStatusCacheKey(userId), status);
}