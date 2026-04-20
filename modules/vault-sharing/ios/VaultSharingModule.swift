import ExpoModulesCore
import UIKit

public class VaultSharingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VaultSharing")

    // Share a file and return whether the user completed the action
    AsyncFunction("shareAsync") { (fileUri: String, promise: Promise) in
      DispatchQueue.main.async {
        guard let url = URL(string: fileUri), url.isFileURL else {
          promise.reject("ERR_INVALID_URI", "Invalid file URI: \(fileUri)")
          return
        }

        // Determine the share item: use UIImage for image files, file URL for everything else
        let shareItem: Any
        if let imageData = try? Data(contentsOf: url),
           let image = UIImage(data: imageData) {
          shareItem = image
        } else {
          shareItem = url
        }

        // Get the root view controller via the active window scene
        guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
              let rootViewController = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController ?? scene.windows.first?.rootViewController else {
          promise.reject("ERR_NO_VIEW_CONTROLLER", "No root view controller found")
          return
        }

        // Find the topmost presented controller so the share sheet isn't blocked
        var presenter = rootViewController
        while let presented = presenter.presentedViewController {
          presenter = presented
        }

        // Create the activity view controller
        let activityViewController = UIActivityViewController(
          activityItems: [shareItem],
          applicationActivities: nil
        )

        // Exclude irrelevant activities
        activityViewController.excludedActivityTypes = [
          .assignToContact,
          .addToReadingList,
          .openInIBooks,
          .markupAsPDF
        ]

        // Set completion handler
        activityViewController.completionWithItemsHandler = { activityType, completed, returnedItems, error in
          if let error = error {
            promise.reject("ERR_SHARE_FAILED", error.localizedDescription)
            return
          }

          // Return the completion status
          promise.resolve([
            "completed": completed,
            "activityType": activityType?.rawValue ?? ""
          ])
        }

        // For iPad, configure the popover
        if let popoverController = activityViewController.popoverPresentationController {
          popoverController.sourceView = presenter.view
          popoverController.sourceRect = CGRect(
            x: presenter.view.bounds.midX,
            y: presenter.view.bounds.midY,
            width: 0,
            height: 0
          )
          popoverController.permittedArrowDirections = []
        }

        presenter.present(activityViewController, animated: true)
      }
    }
  }
}
