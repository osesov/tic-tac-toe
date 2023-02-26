function pad(value, n)
{
    const prefix = Array(n).fill('0').join('');
    return (prefix + String(value)).substr(-n);
}

function timeSec(time)
{
    time = Math.floor(time)

    const sec = pad(time % 60, 2);
    time = time / 60 | 0;

    const min = pad(time % 60, 2);
    time = time / 60 | 0;

    const hour = pad(time % 24, 2);
    time = time / 24 | 0;

    const day = time;

    if (day)
        return `${day} ${hour}:${min}:${sec}`

    if (hour !== '00')
        return `${hour}:${min}:${sec}`

    if (min !== '00')
        return `${min}:${sec}`

    return `${sec}`
}

export default {
    timeSec
}
