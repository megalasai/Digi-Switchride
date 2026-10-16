import SwiftUI

enum AppColors {
    static let greenPrimary = Color(red: 0.357, green: 0.486, blue: 0.980)
    static let greenDark = Color(red: 0.247, green: 0.384, blue: 0.910)
    static let greenLight = Color(red: 0.933, green: 0.945, blue: 1.0)
    static let background = Color(red: 0.953, green: 0.961, blue: 0.984)
    static let textSecondary = Color(red: 0.400, green: 0.439, blue: 0.522)
    static let batteryHigh = Color(red: 0.071, green: 0.718, blue: 0.416)
    static let batteryMid = Color(red: 0.969, green: 0.565, blue: 0.035)
    static let batteryLow = Color(red: 0.941, green: 0.267, blue: 0.220)
}

extension Color {
    static func batteryColor(for percent: Int) -> Color {
        if percent >= 60 { return AppColors.batteryHigh }
        if percent >= 30 { return AppColors.batteryMid }
        return AppColors.batteryLow
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    var loading = false

    func makeBody(configuration: Configuration) -> some View {
        HStack {
            if loading {
                ProgressView().tint(.white)
            } else {
                configuration.label.font(.headline)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(AppColors.greenPrimary.opacity(configuration.isPressed ? 0.85 : 1))
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
