/** The four faint "+" corner marks of the landing (guideline §4). Decoration
 * only: aria-hidden and click-through. `focus-fade` lets the solo test's
 * focus mode fade them with the rest of the chrome. */
export function CropMarks(): React.ReactElement {
  const mark = "fixed text-sm text-[var(--color-text-faint)] pointer-events-none select-none";
  return (
    <div aria-hidden="true" className="focus-fade">
      <span className={`${mark} top-6 left-6`}>+</span>
      <span className={`${mark} top-6 right-6`}>+</span>
      <span className={`${mark} bottom-6 left-6`}>+</span>
      <span className={`${mark} bottom-6 right-6`}>+</span>
    </div>
  );
}
