import RoomTitleFontSync from './RoomTitleFontSync';
import RoomHostGate from './RoomHostGate';
import RoomShareEnhancer from './RoomShareEnhancer';
import CutBannerAds from './CutBannerAds';

export default function TheCutLayout({children}:{children:React.ReactNode}){
  return <div className="the-cut-font-root">
    <RoomTitleFontSync/>
    <RoomShareEnhancer/>
    <style>{`
      .the-cut-font-root main > header + section h1,
      .the-cut-font-root main article h2 {
        font-family: var(--cut-room-title-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif) !important;
        letter-spacing: -0.025em;
      }
    `}</style>
    <RoomHostGate>{children}</RoomHostGate>
    <CutBannerAds/>
  </div>;
}
