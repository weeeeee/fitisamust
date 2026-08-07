function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:' || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '3001')) {
        return 'http://localhost:3001' + endpoint;
    }
    return endpoint;
}

let currentCategory = 'All';
let activeMember = null;
let currentThreadId = null;

document.addEventListener('DOMContentLoaded', () => {
    activeMember = JSON.parse(localStorage.getItem('fitisamust_member'));
    if (!activeMember || !activeMember.id) {
        window.location.href = 'index.html';
        return;
    }

    checkForumAccess();
});

function checkForumAccess() {
    const forumAuth = JSON.parse(sessionStorage.getItem('fitisamust_forum_auth'));
    const gateModal = document.getElementById('forum-gate-modal');

    if (!forumAuth || !forumAuth.authenticated) {
        if (gateModal) gateModal.style.display = 'flex';
        // Auto-fill username if saved in member profile
        if (activeMember && activeMember.forum_username) {
            const input = document.getElementById('gate-forum-username');
            if (input) input.value = activeMember.forum_username;
        }
    } else {
        if (gateModal) gateModal.style.display = 'none';
        loadThreads(currentCategory);
    }
}

async function handleForumAuthentication(e) {
    e.preventDefault();
    const forumUsername = document.getElementById('gate-forum-username').value.trim();
    const forumPassword = document.getElementById('gate-forum-password').value.trim();
    const errorMsg = document.getElementById('gate-error-msg');

    if (!forumUsername || !forumPassword) {
        if (errorMsg) {
            errorMsg.style.display = 'block';
            errorMsg.innerText = 'Please enter both your Forum Username and Forum Password.';
        }
        return;
    }

    try {
        const res = await fetch(getApiUrl('/api/forum/verify-access'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId: activeMember.id,
                forumUsername,
                forumPassword
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            sessionStorage.setItem('fitisamust_forum_auth', JSON.stringify({
                authenticated: true,
                forum_username: data.member.forum_username,
                is_moderator: data.member.is_moderator
            }));
            document.getElementById('forum-gate-modal').style.display = 'none';
            if (errorMsg) errorMsg.style.display = 'none';
            loadThreads(currentCategory);
        } else {
            if (errorMsg) {
                errorMsg.style.display = 'block';
                errorMsg.innerText = data.error || 'Authentication failed. Please check your credentials.';
            }
        }
    } catch (err) {
        console.error(err);
        if (errorMsg) {
            errorMsg.style.display = 'block';
            errorMsg.innerText = 'Network error while verifying forum password.';
        }
    }
}

function lockForumSession() {
    sessionStorage.removeItem('fitisamust_forum_auth');
    document.getElementById('forum-gate-modal').style.display = 'flex';
}

function filterCategory(category) {
    currentCategory = category;

    // Update active tab UI
    document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${category}`);
    if (targetTab) targetTab.classList.add('active');

    loadThreads(category);
}

async function loadThreads(category = 'All') {
    const container = document.getElementById('threads-container');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #94a3b8;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: #38bdf8;"></i>
            <p style="margin-top: 15px;">Loading discussions...</p>
        </div>
    `;

    try {
        const query = category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
        const res = await fetch(getApiUrl(`/api/forum/threads${query}`));
        const threads = await res.json();

        if (!Array.isArray(threads) || threads.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; background: rgba(30, 41, 59, 0.4); border: 1px dashed rgba(255,255,255,0.1); border-radius: 12px;">
                    <i class="fa-solid fa-comments" style="font-size: 2.5rem; color: #64748b; margin-bottom: 15px;"></i>
                    <h3 style="color: #cbd5e1; margin: 0 0 10px 0;">No Threads Yet</h3>
                    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">Be the first member to start a discussion in this section!</p>
                    <button onclick="openNewThreadModal()" class="btn btn-primary" style="background: linear-gradient(135deg, #38bdf8 0%, #a855f7 100%); border: none;">
                        <i class="fa-solid fa-plus"></i> Create First Thread
                    </button>
                </div>
            `;
            return;
        }

        const forumAuth = JSON.parse(sessionStorage.getItem('fitisamust_forum_auth')) || {};
        const isMod = forumAuth.is_moderator;

        container.innerHTML = threads.map(t => {
            const badgeClass = t.category === 'Support' ? 'badge-support' : 'badge-general';
            const icon = t.category === 'Support' ? 'fa-headset' : 'fa-comments';
            const formattedDate = new Date(t.created_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const deleteBtn = isMod ? `<button onclick="event.stopPropagation(); deleteThread(${t.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0 5px;" title="Delete Thread"><i class="fa-solid fa-trash"></i></button>` : '';

            return `
                <div class="thread-card" onclick="openThreadDetail(${t.id})">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <span class="${badgeClass}"><i class="fa-solid ${icon}"></i> ${t.category}</span>
                        <span style="font-size: 0.8rem; color: #64748b;"><i class="fa-regular fa-clock"></i> ${formattedDate} ${deleteBtn}</span>
                    </div>
                    <h3 style="margin: 0 0 10px 0; color: #fff; font-size: 1.15rem; font-weight: 700; line-height: 1.4;">${escapeHtml(t.title)}</h3>
                    <p style="color: #cbd5e1; font-size: 0.9rem; margin: 0 0 15px 0; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${escapeHtml(t.content)}
                    </p>
                    <div class="thread-meta">
                        <div>
                            <i class="fa-solid fa-user-circle" style="color: #38bdf8;"></i> 
                            <span class="thread-author">@${escapeHtml(t.author_username)}</span>
                        </div>
                        <div>
                            <span style="background: rgba(255,255,255,0.06); padding: 4px 12px; border-radius: 15px; font-size: 0.8rem; color: #cbd5e1;">
                                <i class="fa-solid fa-reply" style="color: #a855f7;"></i> ${t.reply_count || 0} ${t.reply_count === 1 ? 'Reply' : 'Replies'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #f87171;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Failed to load discussion threads.</p>
            </div>
        `;
    }
}

function openNewThreadModal() {
    const modal = document.getElementById('new-thread-modal');
    if (modal) modal.style.display = 'block';
}

function closeNewThreadModal() {
    const modal = document.getElementById('new-thread-modal');
    if (modal) modal.style.display = 'none';
}

async function handleCreateThread(e) {
    e.preventDefault();
    const category = document.getElementById('thread-category').value;
    const title = document.getElementById('thread-title').value.trim();
    const content = document.getElementById('thread-content').value.trim();

    if (!title || !content) return;

    try {
        const res = await fetch(getApiUrl('/api/forum/threads'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId: activeMember.id,
                category,
                title,
                content
            })
        });

        if (res.ok) {
            closeNewThreadModal();
            document.getElementById('new-thread-form').reset();
            loadThreads(currentCategory);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to publish thread.');
        }
    } catch (err) {
        console.error(err);
        alert('Error creating thread.');
    }
}

async function openThreadDetail(threadId) {
    currentThreadId = threadId;
    const modal = document.getElementById('thread-detail-modal');
    const headerDiv = document.getElementById('detail-header');
    const repliesDiv = document.getElementById('detail-replies-container');
    document.getElementById('reply-thread-id').value = threadId;

    if (modal) modal.style.display = 'block';
    if (headerDiv) headerDiv.innerHTML = '<p style="color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Loading thread detail...</p>';
    if (repliesDiv) repliesDiv.innerHTML = '';

    try {
        const res = await fetch(getApiUrl(`/api/forum/threads/${threadId}`));
        const data = await res.json();

        if (!res.ok || !data.thread) {
            if (headerDiv) headerDiv.innerHTML = '<p style="color: #f87171;">Thread not found.</p>';
            return;
        }

        const t = data.thread;
        const badgeClass = t.category === 'Support' ? 'badge-support' : 'badge-general';
        const formattedDate = new Date(t.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const forumAuth = JSON.parse(sessionStorage.getItem('fitisamust_forum_auth')) || {};
        const isMod = forumAuth.is_moderator;
        const threadDeleteBtn = isMod ? `<button onclick="deleteThread(${t.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;margin-left:10px;" title="Delete Thread"><i class="fa-solid fa-trash"></i> Delete Thread</button>` : '';

        headerDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="${badgeClass}">${t.category}</span>
                <span style="font-size: 0.8rem; color: #64748b;"><i class="fa-regular fa-clock"></i> ${formattedDate} ${threadDeleteBtn}</span>
            </div>
            <h2 style="margin: 0 0 10px 0; color: #fff; font-size: 1.3rem;">${escapeHtml(t.title)}</h2>
            <div style="font-size: 0.85rem; color: #38bdf8; margin-bottom: 15px;">
                Posted by <strong>@${escapeHtml(t.author_username)}</strong>
            </div>
            <div style="background: rgba(255,255,255,0.03); border-left: 3px solid #38bdf8; padding: 15px; border-radius: 6px; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(t.content)}</div>
        `;

        const replies = data.replies || [];
        if (replies.length === 0) {
            repliesDiv.innerHTML = `
                <div style="text-align: center; padding: 25px; color: #64748b; font-size: 0.9rem;">
                    No replies yet. Start the conversation!
                </div>
            `;
        } else {
            repliesDiv.innerHTML = replies.map(r => {
                const rDate = new Date(r.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const replyDeleteBtn = isMod ? `<button onclick="deleteReply(${r.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0 5px;font-size:0.8rem;" title="Delete Reply"><i class="fa-solid fa-trash"></i></button>` : '';
                return `
                    <div class="reply-box">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <span style="font-weight: 600; color: #38bdf8; font-size: 0.85rem;"><i class="fa-solid fa-user-circle"></i> @${escapeHtml(r.author_username)}</span>
                            <span style="font-size: 0.75rem; color: #64748b;">${rDate} ${replyDeleteBtn}</span>
                        </div>
                        <div style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(r.content)}</div>
                    </div>
                `;
            }).join('');
        }

    } catch (err) {
        console.error(err);
        if (headerDiv) headerDiv.innerHTML = '<p style="color: #f87171;">Error loading thread details.</p>';
    }
}

function closeThreadDetailModal() {
    const modal = document.getElementById('thread-detail-modal');
    if (modal) modal.style.display = 'none';
}

async function handlePostReply(e) {
    e.preventDefault();
    const threadId = document.getElementById('reply-thread-id').value;
    const content = document.getElementById('reply-content').value.trim();

    if (!threadId || !content) return;

    try {
        const res = await fetch(getApiUrl(`/api/forum/threads/${threadId}/replies`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memberId: activeMember.id,
                content
            })
        });

        if (res.ok) {
            document.getElementById('reply-content').value = '';
            openThreadDetail(threadId);
            loadThreads(currentCategory);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to post reply.');
        }
    } catch (err) {
        console.error(err);
        alert('Error posting reply.');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

async function deleteThread(threadId) {
    if (!confirm('Are you sure you want to delete this thread? This action cannot be undone.')) return;
    
    try {
        const res = await fetch(getApiUrl(`/api/forum/threads/${threadId}`), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: activeMember.id })
        });
        
        if (res.ok) {
            closeThreadDetailModal();
            loadThreads(currentCategory);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete thread.');
        }
    } catch (err) {
        console.error(err);
        alert('Error deleting thread.');
    }
}

async function deleteReply(replyId) {
    if (!confirm('Are you sure you want to delete this reply?')) return;
    
    try {
        const res = await fetch(getApiUrl(`/api/forum/replies/${replyId}`), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId: activeMember.id })
        });
        
        if (res.ok) {
            openThreadDetail(currentThreadId);
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete reply.');
        }
    } catch (err) {
        console.error(err);
        alert('Error deleting reply.');
    }
}
