import Foundation

func resolveInstalledAppVersion(bundle: Bundle = .main) -> String {
    let shortVersion = (bundle.infoDictionary?["CFBundleShortVersionString"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines)
    let buildNumber = (bundle.infoDictionary?["CFBundleVersion"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines)

    let normalizedShortVersion = shortVersion?.isEmpty == false ? shortVersion : nil
    let normalizedBuildNumber = buildNumber?.isEmpty == false ? buildNumber : nil

    switch (normalizedShortVersion, normalizedBuildNumber) {
    case let (version?, build?) where version.hasSuffix(".\(build)"):
        return version
    case let (version?, build?):
        return "\(version).\(build)"
    case let (version?, nil):
        return version
    case let (nil, build?):
        return build
    case (nil, nil):
        return "0.0.0"
    }
}
