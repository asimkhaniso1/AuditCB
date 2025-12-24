// Ensure toggleSectionSelection is accessible
console.log('Checking if toggleSectionSelection exists:', typeof window.toggleSectionSelection);
if (typeof window.toggleSectionSelection === 'undefined') {
    console.error('toggleSectionSelection is NOT defined!');
} else {
    console.log('toggleSectionSelection is defined and ready');
}
