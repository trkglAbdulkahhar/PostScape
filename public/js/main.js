// Function to toggle Admin/User fields in Register page
function toggleRole(role) {
    const adminGroup = document.getElementById('adminCodeGroup');
    const roleInput = document.getElementById('roleInput');
    const headerText = document.getElementById('headerText');
    const submitBtn = document.getElementById('submitBtn');
    const adminInput = document.getElementById('adminCode');

    if (!adminGroup) return; // Guard clause if not on register page

    if (role === 'admin') {
        adminGroup.style.display = 'block';
        roleInput.value = 'admin';
        headerText.innerText = 'Join as a System Administrator';
        submitBtn.innerText = 'Register as Admin';
        submitBtn.classList.replace('btn-primary', 'btn-danger');
        adminInput.setAttribute('required', 'required');
    } else {
        adminGroup.style.display = 'none';
        roleInput.value = 'user';
        headerText.innerText = 'Join as a standard user';
        submitBtn.innerText = 'Register as User';
        submitBtn.classList.replace('btn-danger', 'btn-primary');
        adminInput.removeAttribute('required');
        adminInput.value = '';
    }
}
