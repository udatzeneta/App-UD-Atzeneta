import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';

interface YouTubePlayerProps {
  url: string;
  width?: string | number;
  height?: string | number;
  controls?: boolean;
  playing?: boolean;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onProgress?: (state: { playedSeconds: number }) => void;
  onDuration?: (duration: number) => void;
  progressInterval?: number;
}

export const YouTubePlayer = forwardRef<any, YouTubePlayerProps>(({
  url,
  width = '100%',
  height = '100%',
  controls = true,
  playing = false,
  onReady,
  onPlay,
  onPause,
  onProgress,
  onDuration,
  progressInterval = 1000,
}, ref) => {
  const [player, setPlayer] = useState<any>(null);
  const internalPlayerRef = useRef<any>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef<number>(0);

  // Extract video ID from URL
  const getVideoId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))((\w|-){11})/);
    return match ? match[1] : '';
  };

  const videoId = getVideoId(url);

  const disableCaptions = (target: any) => {
    try {
      const t = target || internalPlayerRef.current || player;
      if (t) {
        if (typeof t.unloadModule === 'function') {
          t.unloadModule('captions');
          t.unloadModule('cc');
        }
        if (typeof t.setOption === 'function') {
          t.setOption('captions', 'track', {});
          t.setOption('cc', 'track', {});
          t.setOption('captions', 'fontSize', 0);
          t.setOption('captions', 'reload', false);
        }
      }
    } catch (_) {}
  };

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (internalPlayerRef.current && typeof internalPlayerRef.current.seekTo === 'function') {
        internalPlayerRef.current.seekTo(seconds, true);
        disableCaptions(internalPlayerRef.current);
      }
    },
    getCurrentTime: async () => {
      return internalPlayerRef.current && typeof internalPlayerRef.current.getCurrentTime === 'function'
        ? await internalPlayerRef.current.getCurrentTime()
        : 0;
    },
    getDuration: async () => {
      return internalPlayerRef.current && typeof internalPlayerRef.current.getDuration === 'function'
        ? await internalPlayerRef.current.getDuration()
        : durationRef.current || 0;
    },
    getInternalPlayer: () => internalPlayerRef.current,
    duration: durationRef.current,
  }));

  useEffect(() => {
    if (player) {
      if (playing) {
        player.playVideo();
        disableCaptions(player);
      } else {
        player.pauseVideo();
      }
    }
  }, [playing, player]);

  useEffect(() => {
    if (playing && player) {
      disableCaptions(player);
      progressTimer.current = setInterval(async () => {
        try {
          disableCaptions(player);
          const currentTime = await player.getCurrentTime();
          if (onProgress) {
            onProgress({ playedSeconds: currentTime });
          }
        } catch (e) {}
      }, progressInterval);
    } else {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
      }
    }

    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
      }
    };
  }, [playing, onProgress, player, progressInterval]);

  const opts: YouTubeProps['opts'] = {
    height: height.toString(),
    width: width.toString(),
    playerVars: {
      autoplay: playing ? 1 : 0,
      controls: controls ? 1 : 0,
      rel: 0,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      modestbranding: 1,
      cc_load_policy: 0,
      iv_load_policy: 3,
      hl: 'es',
      playsinline: 1,
      disablekb: 0,
    },
  };

  if (!videoId) return null;

  return (
    <div style={{ width, height }} className="youtube-player-wrapper">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={(e) => {
          internalPlayerRef.current = e.target;
          setPlayer(e.target);
          disableCaptions(e.target);
          try {
            const d = e.target.getDuration();
            if (d && d > 0) {
              durationRef.current = d;
              if (onDuration) onDuration(d);
            }
          } catch (_) {}
          if (onReady) onReady();
        }}
        onPlay={(e) => {
          disableCaptions(e?.target || internalPlayerRef.current);
          if (onPlay) onPlay();
        }}
        onPause={() => {
          if (onPause) onPause();
        }}
        onStateChange={(e) => {
          disableCaptions(e?.target || internalPlayerRef.current);
        }}
        className="w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';
