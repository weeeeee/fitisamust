function getApiUrl(endpoint) {
    if (window.location.protocol === 'file:' || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '3001')) {
        return 'http://localhost:3001' + endpoint;
    }
    return endpoint;
}

document.addEventListener('DOMContentLoaded', () => {
    const member = JSON.parse(localStorage.getItem('fitisamust_member'));
    if (!member || !member.id) {
        window.location.href = 'index.html';
        return;
    }

    async function loadExistingSettings() {
        try {
            const res = await fetch(getApiUrl(`/api/dashboard/${member.id}`));
            const data = await res.json();
            
            if (data.intake_profile) {
                document.getElementById('gender').value = data.intake_profile.gender;
                document.getElementById('age').value = data.intake_profile.age;
                document.getElementById('height').value = data.intake_profile.height;
                document.getElementById('weight').value = data.intake_profile.weight;
                document.getElementById('activity-level').value = data.intake_profile.activity_level;
                document.getElementById('goal').value = data.intake_profile.goal;
            }
            
            if (data.goals) {
                document.getElementById('goal-type').value = data.goals.goal_type;
                document.getElementById('goal-current').value = data.goals.current_value;
                document.getElementById('goal-target').value = data.goals.target_value;
            }

            // Load Forum Settings
            try {
                const forumRes = await fetch(getApiUrl(`/api/member/forum-settings/${member.id}`));
                if (forumRes.ok) {
                    const forumData = await forumRes.json();
                    if (forumData.forum_username) {
                        document.getElementById('forum-username').value = forumData.forum_username;
                    }
                    if (forumData.has_forum_password) {
                        document.getElementById('forum-password').placeholder = '•••••••• (Enter to set/update)';
                        document.getElementById('forum-password').removeAttribute('required');
                    }
                }
            } catch (fErr) {
                console.error('Failed to load forum settings', fErr);
            }
        } catch (err) {
            console.error('Failed to load existing settings', err);
        }
    }
    loadExistingSettings();

    // Forum Credentials Form Handler
    const forumForm = document.getElementById('forum-credentials-form');
    if (forumForm) {
        forumForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const forumUsername = document.getElementById('forum-username').value.trim();
            const forumPassword = document.getElementById('forum-password').value.trim();
            const statusDiv = document.getElementById('forum-credentials-status');

            if (!forumUsername || !forumPassword) {
                if (statusDiv) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
                    statusDiv.style.color = '#f87171';
                    statusDiv.innerText = 'Please enter both a Forum Username and Forum Password.';
                }
                return;
            }

            try {
                const res = await fetch(getApiUrl('/api/member/forum-settings'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        memberId: member.id,
                        forumUsername,
                        forumPassword
                    })
                });
                const data = await res.json();

                if (res.ok) {
                    if (statusDiv) {
                        statusDiv.style.display = 'block';
                        statusDiv.style.background = 'rgba(34, 197, 94, 0.2)';
                        statusDiv.style.color = '#4ade80';
                        statusDiv.innerText = 'Forum credentials saved successfully! You can now log into the Forum.';
                    }
                    member.forum_username = forumUsername;
                    localStorage.setItem('fitisamust_member', JSON.stringify(member));
                } else {
                    if (statusDiv) {
                        statusDiv.style.display = 'block';
                        statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
                        statusDiv.style.color = '#f87171';
                        statusDiv.innerText = data.error || 'Failed to update forum credentials.';
                    }
                }
            } catch (err) {
                console.error(err);
                if (statusDiv) {
                    statusDiv.style.display = 'block';
                    statusDiv.style.background = 'rgba(239, 68, 68, 0.2)';
                    statusDiv.style.color = '#f87171';
                    statusDiv.innerText = 'Network error occurred while saving forum credentials.';
                }
            }
        });
    }

    document.getElementById('intake-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            memberId: member.id,
            gender: document.getElementById('gender').value,
            age: parseInt(document.getElementById('age').value),
            height: parseInt(document.getElementById('height').value),
            weight: parseInt(document.getElementById('weight').value),
            activityLevel: document.getElementById('activity-level').value,
            goal: document.getElementById('goal').value,
        };
        
        try {
            const res = await fetch(getApiUrl('/api/intake'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                alert('Your macro profile has been updated!');
                window.location.href = 'member.html';
            } else {
                alert('Failed to save intake profile.');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred.');
        }
    });

    document.getElementById('goal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const goalType = document.getElementById('goal-type').value;
        const current = document.getElementById('goal-current').value;
        const target = document.getElementById('goal-target').value;
        
        try {
            const res = await fetch(getApiUrl('/api/goals'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memberId: member.id, goalType, currentValue: current, targetValue: target })
            });
            
            if (res.ok) {
                alert('Your fitness goal has been updated!');
                window.location.href = 'member.html';
            } else {
                alert('Failed to save fitness goal.');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred.');
        }
    });
});
