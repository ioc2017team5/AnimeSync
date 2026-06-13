const { ref, onMounted, onBeforeUnmount, nextTick, watch } = Vue;

const HOLODEX_API_KEY = "49db2644-7902-4cc1-81bf-c9c5e763011a";
const HOLODEX_API_BASE = "https://holodex.net/api/v2";
const REFRESH_INTERVAL_MS = 60000;

const app = Vue.createApp({
    setup() {
        const EMBEDDED_URL = "https://www.youtube.com/embed/";

        const videoSource = ref([null, null]);
        const containerState = ref(["input", "input"]); // input or video
        const videoRef = ref(null);
        const videoBarValue = ref(0);
        const videoTime = ref("00:00:00");
        const videoType = ref(["file", "youtube"]); // file or youtube
        const youtubeID = ref(["", ""]);
        const youtubeURL = ref([null, null]);
        const youtubeSource = ref([null, null]);
        const playerInstance = ref([null, null]);

        const programs = ref([]);
        const isProgramLoading = ref(false);
        const isProgramListCollapsed = ref(false);
        const statusFilter = ref("live");
        const organization = ref("All Vtubers");
        let refreshTimer = null;

        onMounted(() => {
            loadIframeAPI();
            fetchPrograms();
            refreshTimer = setInterval(fetchPrograms, REFRESH_INTERVAL_MS);
        });

        onBeforeUnmount(() => {
            if (refreshTimer) clearInterval(refreshTimer);
        });

        const loadIframeAPI = () => {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName("script")[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        };
        const chooseVideo = (event, index) => {
            const file = event.target.files[0];
            const src = window.URL.createObjectURL(file);

            containerState.value[index] = "video";
            videoSource.value[index] = src;
        };
        const updateDisplayTime = () => {
            // currentVideo.value = videoRef.value;
            if (videoRef.value !== null) {
                videoTime.value = secondsToHms(videoRef.value.currentTime);
                videoBarValue.value =
                    (videoRef.value.currentTime / videoRef.value.duration) *
                    100;
            }
        };
        const togglePlay = (event) => {
            const videoWidth = videoRef.value.offsetWidth;
            if (
                event.offsetX > videoWidth / 2 - videoWidth / 6 &&
                event.offsetX < videoWidth / 2 + videoWidth / 6
            ) {
                if (videoRef.value.paused) {
                    videoRef.value.play();
                    videoRef.value.muted = false;
                    if (playerInstance.value[1]) {
                        playerInstance.value[1].playVideo();
                        playerInstance.value[1].unMute();
                    }
                } else {
                    videoRef.value.pause();
                    videoRef.value.muted = true;
                    if (playerInstance.value[1]) {
                        playerInstance.value[1].mute();
                    }
                }
            }
        };
        const doubleClickHandler = (event) => {
            const videoWidth = videoRef.value.offsetWidth;
            if (playerInstance.value[1]) {
                playerInstance.value[1].mute();
            }
            if (event.offsetX < videoWidth / 2 - videoWidth / 6) {
                rewindVideo();
            } else if (event.offsetX > videoWidth / 2 + videoWidth / 6) {
                forwardVideo();
            }
        };
        const secondsToHms = (seconds) => {
            const number = Number(seconds);
            const h = Math.floor(number / 3600);
            const m = Math.floor((number % 3600) / 60);
            const s = Math.floor((number % 3600) % 60);

            const hDisplay = h >= 10 ? h + "" : "0" + h;
            const mDisplay = m >= 10 ? m + "" : "0" + m;
            const sDisplay = s >= 10 ? s + "" : "0" + s;
            return hDisplay + ":" + mDisplay + ":" + sDisplay;
        };
        const rewindVideo = () => {
            console.log("rewind");
            videoRef.value.currentTime -= 3;
        };
        const forwardVideo = () => {
            console.log("forward");
            videoRef.value.currentTime += 3;
        };
        const playVideo = () => {
            if (videoRef.value) {
                videoRef.value.play();
                videoRef.value.muted = false;
            }
            if (playerInstance.value[1]) {
                playerInstance.value[1].playVideo();
                playerInstance.value[1].unMute();
            }
        };
        const pauseVideo = () => {
            if (videoRef.value) {
                videoRef.value.pause();
            }
            if (playerInstance.value[1]) {
                playerInstance.value[1].pauseVideo();
            }
        };
        const returnToInput = (index) => {
            if (playerInstance.value[index]) {
                playerInstance.value[index].destroy();
                playerInstance.value[index] = null;
            }
            if (index === 0) {
                videoRef.value = null;
                videoTime.value = "00:00:00";
                videoBarValue.value = 0;
                if (videoSource.value[0]) {
                    window.URL.revokeObjectURL(videoSource.value[0]);
                    videoSource.value[0] = null;
                }
            }
            youtubeURL.value[index] = null;
            youtubeID.value[index] = "";
            youtubeSource.value[index] = null;
            containerState.value[index] = "input";
        };
        const dragVideoTime = () => {
            if (!videoRef.value) return;
            const newTime = (videoBarValue.value / 100) * videoRef.value.duration;
            videoRef.value.currentTime = newTime;
            if (playerInstance.value[1]) {
                playerInstance.value[1].seekTo(newTime, true);
            }
        };
        const parseYoutubeId = (url) => {
            if (!url) return null;
            const parts = url.split(/[/?=&]/);
            const keywords = ["watch", "youtu.be", "embed", "live"];
            const keyword = keywords.find((k) => parts.includes(k));
            if (!keyword) return null;
            const anchor = keyword === "watch" ? "v" : keyword;
            const id = parts[parts.indexOf(anchor) + 1];
            return id || null;
        };
        const confirmURL = (blockIndex) => {
            const videoId = parseYoutubeId(youtubeURL.value[blockIndex]);
            if (!videoId) {
                alert("無法解析的 YouTube 網址，請確認格式。");
                return;
            }

            youtubeID.value[blockIndex] = videoId;
            youtubeSource.value[blockIndex] = EMBEDDED_URL + videoId;
            containerState.value[blockIndex] = "video";

            nextTick(() => {
                const playerId = "player" + (parseInt(blockIndex) + 1);
                createIFrameAPI(blockIndex, videoId, playerId);
            });
        };
        const createIFrameAPI = (index, videoId, playerId) => {
            window.YT.ready(function () {
                playerInstance.value[index] = new window.YT.Player(playerId, {
                    height: "390",
                    width: "640",
                    videoId: videoId,
                    events: {
                        onReady: onPlayerReady,
                        onStateChange: onPlayerStateChange,
                    },
                });
            });
        };
        const onPlayerReady = (event) => {
            event.target.mute();
            event.target.playVideo();
        };
        const onPlayerStateChange = (event) => {
            console.log("onPlayerStateChange", event);
        };
        const changeVideoType = (index, tabName) => {
            videoType.value[index] = tabName;
        };

        const fetchPrograms = async () => {
            isProgramLoading.value = true;
            try {
                const params = new URLSearchParams({
                    status: statusFilter.value,
                    type: "stream",
                    include: "live_info",
                    limit: "50",
                    sort: statusFilter.value === "live" ? "live_viewers" : "start_scheduled",
                    order: statusFilter.value === "live" ? "desc" : "asc",
                });
                if (organization.value !== "All Vtubers") {
                    params.append("org", organization.value);
                }

                const response = await fetch(`${HOLODEX_API_BASE}/live?${params.toString()}`, {
                    headers: { "X-APIKEY": HOLODEX_API_KEY },
                });
                if (!response.ok) {
                    console.error("Holodex API error", response.status, response.statusText);
                    programs.value = [];
                    return;
                }
                const data = await response.json();
                programs.value = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error("Failed to fetch Holodex live streams", error);
                programs.value = [];
            } finally {
                isProgramLoading.value = false;
            }
        };
        const loadYoutubeVideo = (blockIndex, videoId) => {
            if (playerInstance.value[blockIndex]) {
                playerInstance.value[blockIndex].destroy();
                playerInstance.value[blockIndex] = null;
            }
            videoType.value[blockIndex] = "youtube";
            youtubeID.value[blockIndex] = videoId;
            youtubeURL.value[blockIndex] = `https://www.youtube.com/watch?v=${videoId}`;
            youtubeSource.value[blockIndex] = EMBEDDED_URL + videoId;
            containerState.value[blockIndex] = "video";

            nextTick(() => {
                const playerId = "player" + (blockIndex + 1);
                createIFrameAPI(blockIndex, videoId, playerId);
            });
        };
        const selectProgram = (program) => {
            if (!program || !program.id) return;
            const inputIndex = containerState.value.findIndex((s) => s === "input");
            const targetIndex = inputIndex !== -1 ? inputIndex : 0;
            loadYoutubeVideo(targetIndex, program.id);
        };
        const changeProgramStatus = (status) => {
            if (statusFilter.value === status) return;
            statusFilter.value = status;
            fetchPrograms();
        };
        const toggleProgramList = () => {
            isProgramListCollapsed.value = !isProgramListCollapsed.value;
        };
        const formatViewers = (count) => {
            if (count >= 1000000) return (count / 1000000).toFixed(1) + "M";
            if (count >= 1000) return (count / 1000).toFixed(1) + "K";
            return String(count);
        };
        const formatStartTime = (iso) => {
            if (!iso) return "";
            const date = new Date(iso);
            const diffMin = Math.round((date - new Date()) / 60000);
            if (diffMin < 0) return "Soon";
            if (diffMin < 60) return `in ${diffMin}m`;
            const diffHour = Math.floor(diffMin / 60);
            if (diffHour < 24) return `in ${diffHour}h`;
            return date.toLocaleDateString();
        };

        watch(videoRef, (val) => {
            if (val !== null) {
                val.muted = true;
            }
        });

        return {
            videoRef,
            videoBarValue,
            videoType,
            videoTime,
            videoSource,
            youtubeURL,
            youtubeSource,
            containerState,
            chooseVideo,
            changeVideoType,
            updateDisplayTime,
            togglePlay,
            doubleClickHandler,
            playVideo,
            pauseVideo,
            returnToInput,
            confirmURL,
            dragVideoTime,
            programs,
            isProgramLoading,
            isProgramListCollapsed,
            statusFilter,
            organization,
            fetchPrograms,
            selectProgram,
            changeProgramStatus,
            toggleProgramList,
            formatViewers,
            formatStartTime,
        };
    },
});

app.mount("#vueEntry");
