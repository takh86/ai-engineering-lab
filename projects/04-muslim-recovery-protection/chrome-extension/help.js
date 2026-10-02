const start = document.querySelector('#start');
if (start) start.addEventListener('click', () => {
    start.disabled = true;
    const end = Date.now() + 60000;
    const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        document.querySelector('#timer').textContent = left.toLocaleString('ar');
        if (left === 0) {
            clearInterval(interval);
            document.querySelector('#step').textContent = 'دلوقتي اختار خطوة واحدة: ابعد الجهاز، غيّر مكانك، أو كلم شخصًا تثق فيه.';
            start.disabled = false;
            start.textContent = 'دقيقة أخرى';
        }
    }, 250);
});
