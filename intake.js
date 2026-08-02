document.addEventListener('DOMContentLoaded', () => {
    const member = JSON.parse(localStorage.getItem('fitisamust_member'));
    if (!member || !member.id) {
        window.location.href = 'index.html';
        return;
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
            const res = await fetch('/api/intake', {
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
});
