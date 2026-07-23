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
  progressInterval = 1000,
}, ref) => {
  const [player, setPlayer] = useState<any>(null);
  const internalPlayerRef = useRef<any>(null);
  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Extract video ID from URL
  const getVideoId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))((\w|-){11})/);
    return match ? match[1] : '';
  };

  const videoId = getVideoId(url);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (internalPlayerRef.current) {
        internalPlayerRef.current.seekTo(seconds, true);
      }
    },
    getCurrentTime: async () => {
      return internalPlayerRef.current ? await internalPlayerRef.current.getCurrentTime() : 0;
    },
    getDuration: async () => {
      return internalPlayerRef.current ? await internalPlayerRef.current.getDuration() : 0;
    }
  }));

  useEffect(() => {
    if (player) {
      if (playing) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }
  }, [playing, player]);

  useEffect(() => {
    if (playing && player) {
      progressTimer.current = setInterval(async () => {
        try {
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
      modestbranding: 1
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
          if (onReady) onReady();
        }}
        onPlay={() => {
          if (onPlay) onPlay();
        }}
        onPause={() => {
          if (onPause) onPause();
        }}
        className="w-full h-full"
        iframeClassName="w-full h-full"
      />
    </div>
  );
});

YouTubePlayer.displayName = 'YouTubePlayer';
