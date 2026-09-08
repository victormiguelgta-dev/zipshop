// Toggle do menu lateral no mobile (painel admin)
window.openAdminMenu = function() {
  document.querySelector('.admin-sidebar')?.classList.add('open');
  document.getElementById('admin-sidebar-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeAdminMenu = function() {
  document.querySelector('.admin-sidebar')?.classList.remove('open');
  document.getElementById('admin-sidebar-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
};

document.addEventListener('click', (e) => {
  if (e.target.closest('.admin-sidebar a')) closeAdminMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAdminMenu();
});
